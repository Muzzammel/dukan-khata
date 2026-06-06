// lib/gemini.ts
import type { ExtractedData } from '@/types';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const EXTRACTION_PROMPT = `This is a handwritten shop register/ledger page. Extract every row carefully.

Return ONLY valid JSON — no markdown, no backticks, no preamble:
{
  "date": "YYYY-MM-DD format if possible, else as written",
  "entries": [
    {
      "invoiceNo": "784",
      "orderNo": "1",
      "type": "A",
      "amount": 320,
      "advance": 50,
      "due": 270,
      "notes": "",
      "confidence": 0.95
    }
  ],
  "expenses": [
    { "description": "H", "amount": 60, "confidence": 0.8 }
  ],
  "summary": {
    "grossTotal": 1940,
    "totalAdvance": 1930,
    "netBalance": 10,
    "prevBalance": 24864,
    "grandTotal": 24874,
    "discount": 0
  }
}

Parsing rules:
- "type" is ONLY "A" (Advance — partial payment, order pending) or "D" (Delivered/paid/complete).
- "orderNo" is the number before A or D in each row. Example: "1A" → orderNo="1", type="A".
- If a row says "Paid", set due=0 and advance=amount.
- Where a dash (—) appears in a column, use 0.
- Expenses are misc items at the bottom of the page, often labeled H, S, or similar with small amounts.
- Discounts (amounts deducted from total) go in summary.discount.
- Do NOT skip any row. Include every invoice number found.
- For numeric fields always return numbers, never strings.
- "confidence" is a number 0..1 for how clearly you could read that row. Use lower values (e.g. 0.4) for smudged/ambiguous handwriting and high values (0.95) for clearly legible rows. Always include it.`;

export async function extractFromImage(base64Image: string): Promise<ExtractedData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Image,
            },
          },
          { text: EXTRACTION_PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0.1,      // Low temp = more deterministic, better for data extraction
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!raw) {
    throw new Error('Gemini returned empty response');
  }

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/```json|```/gi, '').trim();

  let parsed: ExtractedData;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Gemini JSON. Raw output: ${cleaned.slice(0, 400)}`);
  }

  // Ensure arrays always exist even if Gemini omits them
  parsed.entries  = parsed.entries  ?? [];
  parsed.expenses = parsed.expenses ?? [];
  parsed.summary  = parsed.summary  ?? {
    grossTotal: 0, totalAdvance: 0, netBalance: 0,
    prevBalance: 0, grandTotal: 0, discount: 0,
  };

  // Sanitize types: coerce strings to numbers, validate A/D
  const clamp01 = (x: unknown) => {
    const n = Number(x);
    if (!Number.isFinite(n)) return 0.6; // unknown -> medium confidence
    return Math.max(0, Math.min(1, n));
  };

  parsed.entries = parsed.entries.map(e => ({
    ...e,
    amount:  Number(e.amount)  || 0,
    advance: Number(e.advance) || 0,
    due:     Number(e.due)     || 0,
    type:    e.type === 'D' ? 'D' : 'A',
    invoiceNo: String(e.invoiceNo ?? ''),
    orderNo:   String(e.orderNo   ?? ''),
    notes:     String(e.notes     ?? ''),
    confidence: clamp01(e.confidence),
  }));

  parsed.expenses = parsed.expenses.map(e => ({
    ...e,
    amount: Number(e.amount) || 0,
    description: String(e.description ?? ''),
    confidence: clamp01(e.confidence),
  }));

  return parsed;
}
