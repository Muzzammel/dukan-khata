// lib/invoiceRules.ts
// Pure, dependency-free business rules for the ledger. Kept separate from the
// API route so they can be unit-tested without a database or network.
//
// Rules:
//   Type A (Advance): an invoice number may appear only once. No duplicates.
//   Type D (Delivered): a duplicate invoice number is allowed ONLY if the
//   existing rows for that invoice still have a remaining due balance (> 0).

export type EntryType = 'A' | 'D';

export interface ExistingInvoiceRow {
  type: EntryType;
  due: number;
}

export interface RuleResult {
  ok: boolean;
  /** Present when ok === false */
  error?: string;
  /** HTTP-style status hint for the API layer */
  status?: number;
}

/**
 * Decide whether a new entry with the given invoice number is allowed,
 * based on the rows that already exist for that invoice number in the shop.
 *
 * @param type        Type of the entry being created ('A' | 'D')
 * @param invoiceNo   Invoice number being used (may be empty)
 * @param existing    Existing rows that share this invoice number (same shop)
 */
export function checkInvoiceRule(
  type: EntryType,
  invoiceNo: string | undefined | null,
  existing: ExistingInvoiceRow[],
): RuleResult {
  const inv = (invoiceNo ?? '').trim();

  // No invoice number => nothing to deduplicate.
  if (!inv) return { ok: true };

  // Invalid type guard.
  if (type !== 'A' && type !== 'D') {
    return { ok: false, error: 'type must be A or D', status: 400 };
  }

  if (!existing || existing.length === 0) return { ok: true };

  if (type === 'A') {
    return {
      ok: false,
      status: 409,
      error: `Invoice ${inv} already exists. Advance invoices cannot be duplicated.`,
    };
  }

  // type === 'D'
  const remaining = existing.reduce((sum, e) => sum + (Number(e.due) || 0), 0);
  if (remaining <= 0) {
    return {
      ok: false,
      status: 409,
      error: `Invoice ${inv} is already fully settled — no remaining balance to deliver against.`,
    };
  }

  return { ok: true };
}

/** Auto-calculated due: never negative. */
export function calcDue(amount: number, advance: number): number {
  return Math.max(0, (Number(amount) || 0) - (Number(advance) || 0));
}

/** Apply a payment amount across rows oldest-first, returning new due values. */
export function applyPayment(
  rows: { id: string; due: number }[],
  payment: number,
): { id: string; due: number }[] {
  let remaining = Math.max(0, Number(payment) || 0);
  return rows.map(r => {
    const due = Number(r.due) || 0;
    if (remaining <= 0 || due <= 0) return { id: r.id, due };
    const applied = Math.min(remaining, due);
    remaining -= applied;
    return { id: r.id, due: due - applied };
  });
}
