import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractFromImage } from '@/lib/gemini';
import type { ExtractedData } from '@/types';

export const maxDuration = 30;

// ── Simple in-memory rate limiter (per user) ──────────────
// Protects the Gemini quota from rapid/stuck uploads. Best-effort: serverless
// instances may not share memory, but it stops bursts within a single instance.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): { limited: boolean; retryAfter?: number } {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - arr[0])) / 1000);
    hits.set(userId, arr);
    return { limited: true, retryAfter };
  }
  arr.push(now);
  hits.set(userId, arr);
  return { limited: false };
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = rateLimited(user.id);
  if (rl.limited) {
    return NextResponse.json(
      { error: `Too many scans. Please wait ${rl.retryAfter}s and try again.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    );
  }

  let body: { shopId: string; image: string; date?: string; preview?: boolean };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { shopId, image, date, preview } = body;
  if (!shopId || !image) return NextResponse.json({ error: 'shopId and image required' }, { status: 400 });

  // Verify shop belongs to user
  const { data: shop } = await supabase.from('shops').select('id')
    .eq('id', shopId).eq('user_id', user.id).single();
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  let extracted: ExtractedData;
  try {
    extracted = await extractFromImage(image);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Extraction error';
    await supabase.from('upload_logs').insert({ shop_id: shopId, status: 'error', error_message: message, entry_count: 0, expense_count: 0 });
    return NextResponse.json({ error: 'Extraction failed', details: message }, { status: 500 });
  }

  const entryDate = date ?? extracted.date ?? new Date().toISOString().split('T')[0];

  // ── Preview mode: return parsed rows for user review, save nothing ──
  if (preview) {
    return NextResponse.json({ success: true, preview: true, date: entryDate, extracted });
  }

  // ── Legacy auto-save mode (kept for backward compatibility) ──
  let insertedEntries = 0;
  let insertedExpenses = 0;

  if (extracted.entries.length > 0) {
    const { error } = await supabase.from('entries').insert(
      extracted.entries.map(e => ({
        shop_id:       shopId,
        invoice_no:    e.invoiceNo,
        order_no:      e.orderNo,
        customer_name: e.customerName ?? '',
        type:          e.type,
        amount:        e.amount,
        advance:       e.advance,
        due:           e.due,
        notes:         e.notes,
        entry_date:    entryDate,
      }))
    );
    if (!error) insertedEntries = extracted.entries.length;
  }

  if (extracted.expenses.length > 0) {
    const { error } = await supabase.from('expenses').insert(
      extracted.expenses.map(e => ({
        shop_id:     shopId,
        category:    'Other',
        description: e.description,
        amount:      e.amount,
        entry_date:  entryDate,
      }))
    );
    if (!error) insertedExpenses = extracted.expenses.length;
  }

  await supabase.from('upload_logs').insert({
    shop_id: shopId, raw_json: extracted as unknown as Record<string, unknown>,
    status: 'success', entry_count: insertedEntries, expense_count: insertedExpenses,
  });

  return NextResponse.json({ success: true, entries: insertedEntries, expenses: insertedExpenses, date: entryDate, extracted });
}
