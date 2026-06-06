'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/offline';
import { calcDue } from '@/lib/invoiceRules';
import { EXPENSE_CATEGORIES } from '@/types';
import type { ExtractedData, EntryType, ExpenseCategory } from '@/types';

interface RowEntry {
  include: boolean; invoiceNo: string; orderNo: string; customerName: string;
  type: EntryType; amount: number; advance: number; notes: string; confidence: number; error?: string;
}
interface RowExpense { include: boolean; description: string; amount: number; category: ExpenseCategory; confidence: number; error?: string; }

interface Props {
  open: boolean;
  shopId: string;
  date: string;
  data: ExtractedData | null;
  onClose: () => void;
  onSaved: (counts: { entries: number; expenses: number }) => void;
}

function confColor(c: number) {
  if (c >= 0.85) return 'var(--green)';
  if (c >= 0.6)  return 'var(--amber)';
  return 'var(--red)';
}
function confLabel(c: number) {
  if (c >= 0.85) return 'High';
  if (c >= 0.6)  return 'Check';
  return 'Low';
}

export function ScanReview({ open, shopId, date, data, onClose, onSaved }: Props) {
  const [entries, setEntries] = useState<RowEntry[]>([]);
  const [expenses, setExpenses] = useState<RowExpense[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !data) return;
    setEntries(data.entries.map(e => ({
      include: true, invoiceNo: e.invoiceNo, orderNo: e.orderNo || '1',
      customerName: e.customerName ?? '', type: e.type,
      amount: e.amount, advance: e.advance, notes: e.notes,
      confidence: e.confidence ?? 0.6,
    })));
    setExpenses(data.expenses.map(x => ({
      include: true, description: x.description, amount: x.amount,
      category: 'Other', confidence: x.confidence ?? 0.6,
    })));
  }, [open, data]);

  if (!open || !data) return null;

  const setEntry = (i: number, patch: Partial<RowEntry>) =>
    setEntries(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const setExpense = (i: number, patch: Partial<RowExpense>) =>
    setExpenses(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const includedEntries  = entries.filter(e => e.include).length;
  const includedExpenses = expenses.filter(e => e.include).length;
  const lowCount = [...entries, ...expenses].filter(r => r.include && r.confidence < 0.6).length;

  const save = async () => {
    setSaving(true);
    let okE = 0, okX = 0;
    const newEntries = [...entries];
    for (let i = 0; i < newEntries.length; i++) {
      const e = newEntries[i];
      if (!e.include) continue;
      try {
        await apiFetch('/api/entries', { method: 'POST', body: JSON.stringify({
          shop_id: shopId, entry_date: date, type: e.type,
          invoice_no: e.invoiceNo, order_no: e.orderNo, customer_name: e.customerName,
          amount: e.amount, advance: e.advance, due: calcDue(e.amount, e.advance), notes: e.notes,
        }) });
        newEntries[i] = { ...e, include: false, error: undefined };
        okE++;
      } catch (err) {
        newEntries[i] = { ...e, error: (err as Error).message };
      }
    }
    setEntries(newEntries);

    const newExpenses = [...expenses];
    for (let i = 0; i < newExpenses.length; i++) {
      const x = newExpenses[i];
      if (!x.include) continue;
      try {
        await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify({
          shop_id: shopId, entry_date: date, category: x.category, description: x.description, amount: x.amount,
        }) });
        newExpenses[i] = { ...x, include: false, error: undefined };
        okX++;
      } catch (err) {
        newExpenses[i] = { ...x, error: (err as Error).message };
      }
    }
    setExpenses(newExpenses);
    setSaving(false);

    const anyErr = newEntries.some(e => e.error) || newExpenses.some(e => e.error);
    onSaved({ entries: okE, expenses: okX });
    if (!anyErr) onClose();
  };

  const fieldMini: React.CSSProperties = { padding: '8px 10px', fontSize: 14 };

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal-sheet" role="dialog" aria-label="Review scanned rows">
        <div className="modal-handle" />
        <div className="modal-title">🔍 Review scan</div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: -14, marginBottom: 18 }}>
          {includedEntries} entries · {includedExpenses} expenses selected · date {date}
          {lowCount > 0 && <span style={{ color: 'var(--red)', fontWeight: 700 }}> · {lowCount} low-confidence row{lowCount > 1 ? 's' : ''} to check</span>}
        </p>

        {entries.length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Entries</div>
        )}
        {entries.map((e, i) => (
          <div key={i} className="glass glass-pad" style={{ padding: 14, marginBottom: 10, opacity: e.include ? 1 : 0.5, borderLeft: `3px solid ${confColor(e.confidence)}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                <input type="checkbox" checked={e.include} onChange={ev => setEntry(i, { include: ev.target.checked })} aria-label={`Include entry ${i + 1}`} />
                Include
              </label>
              <span className="badge" style={{ background: 'transparent', color: confColor(e.confidence), border: `1px solid ${confColor(e.confidence)}` }}>
                {confLabel(e.confidence)} · {Math.round(e.confidence * 100)}%
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {(['A', 'D'] as EntryType[]).map(t => (
                  <button key={t} onClick={() => setEntry(i, { type: t })} className={`badge badge-${t.toLowerCase()}`}
                    style={{ cursor: 'pointer', opacity: e.type === t ? 1 : 0.4, border: e.type === t ? '1px solid currentColor' : '1px solid transparent' }}>
                    {t === 'A' ? 'Advance' : 'Delivered'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input className="field" style={fieldMini} placeholder="Invoice" value={e.invoiceNo} onChange={ev => setEntry(i, { invoiceNo: ev.target.value })} aria-label="Invoice number" />
              <input className="field" style={fieldMini} placeholder="Customer" value={e.customerName} onChange={ev => setEntry(i, { customerName: ev.target.value })} aria-label="Customer name" />
              <input className="field" style={{ ...fieldMini, fontFamily: 'var(--mono)' }} type="number" placeholder="Amount" value={e.amount || ''} onChange={ev => setEntry(i, { amount: parseFloat(ev.target.value) || 0 })} aria-label="Amount" />
              <input className="field" style={{ ...fieldMini, fontFamily: 'var(--mono)' }} type="number" placeholder="Advance" value={e.advance || ''} onChange={ev => setEntry(i, { advance: parseFloat(ev.target.value) || 0 })} aria-label="Advance" />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Due: QR {calcDue(e.amount, e.advance).toLocaleString('en-US')}</div>
            {e.error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6, fontWeight: 700 }}>⚠ {e.error}</div>}
          </div>
        ))}

        {expenses.length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '8px 0 10px' }}>Expenses</div>
        )}
        {expenses.map((x, i) => (
          <div key={i} className="glass glass-pad" style={{ padding: 14, marginBottom: 10, opacity: x.include ? 1 : 0.5, borderLeft: `3px solid ${confColor(x.confidence)}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                <input type="checkbox" checked={x.include} onChange={ev => setExpense(i, { include: ev.target.checked })} aria-label={`Include expense ${i + 1}`} />
                Include
              </label>
              <span className="badge" style={{ background: 'transparent', color: confColor(x.confidence), border: `1px solid ${confColor(x.confidence)}` }}>
                {Math.round(x.confidence * 100)}%
              </span>
              <select className="field" style={{ ...fieldMini, width: 'auto', marginLeft: 'auto' }} value={x.category} onChange={ev => setExpense(i, { category: ev.target.value as ExpenseCategory })} aria-label="Category">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
              <input className="field" style={fieldMini} placeholder="Description" value={x.description} onChange={ev => setExpense(i, { description: ev.target.value })} aria-label="Description" />
              <input className="field" style={{ ...fieldMini, fontFamily: 'var(--mono)' }} type="number" placeholder="Amount" value={x.amount || ''} onChange={ev => setExpense(i, { amount: parseFloat(ev.target.value) || 0 })} aria-label="Expense amount" />
            </div>
            {x.error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6, fontWeight: 700 }}>⚠ {x.error}</div>}
          </div>
        ))}

        {entries.length === 0 && expenses.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 14 }}>Nothing was detected. Try a clearer photo.</div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 12, position: 'sticky', bottom: 0 }}>
          <button className="btn btn-glass" style={{ flex: 1 }} onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving || (includedEntries + includedExpenses === 0)}>
            {saving ? <><span className="spin">⟳</span>&nbsp;Saving…</> : `Save ${includedEntries + includedExpenses} row${includedEntries + includedExpenses === 1 ? '' : 's'} ✓`}
          </button>
        </div>
      </div>
    </div>
  );
}
