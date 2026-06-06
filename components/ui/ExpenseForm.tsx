'use client';
import { useState, useEffect } from 'react';
import { EXPENSE_CATEGORIES } from '@/types';
import type { Expense, ExpenseCategory } from '@/types';

interface Props {
  open: boolean; onClose: () => void;
  onSave: (data: Partial<Expense>) => Promise<{ error?: string }>;
  shopId: string;
  initial?: Partial<Expense>;
}
const today = () => new Date().toISOString().split('T')[0];
const ICONS: Record<string, string> = {
  Rent:'🏠', Electricity:'⚡', Salary:'👥', Transport:'🚗',
  Marketing:'📣', Supplies:'📦', Maintenance:'🔧', Other:'📝',
};
const COLORS: Record<string, string> = {
  Rent:'#7c6fcd', Electricity:'#f59e0b', Salary:'#10b981', Transport:'#3b82f6',
  Marketing:'#ec4899', Supplies:'#f97316', Maintenance:'#8b5cf6', Other:'#6b7280',
};

export function ExpenseForm({ open, onClose, onSave, shopId, initial }: Props) {
  const [date,     setDate]     = useState(today());
  const [category, setCategory] = useState<ExpenseCategory>('Other');
  const [desc,     setDesc]     = useState('');
  const [amount,   setAmount]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    setDate(initial?.entry_date ?? today());
    setCategory((initial?.category as ExpenseCategory) ?? 'Other');
    setDesc(initial?.description ?? '');
    setAmount(initial?.amount ? String(initial.amount) : '');
    setError('');
  }, [open, initial]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError('Amount is required'); return; }
    setSaving(true); setError('');
    const payload: Partial<Expense> = { shop_id: shopId, entry_date: date, category, description: desc, amount: parseFloat(amount)||0 };
    if (isEdit) payload.id = initial!.id;
    const res = await onSave(payload);
    setSaving(false);
    if (res?.error) setError(res.error); else onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop open" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-title">{isEdit ? '✏️ Edit Expense' : '+ New Expense'}</div>

        <div className="field-group">
          <label className="field-label">Date</label>
          <input type="date" className="field" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        {/* Category grid — neumorphic tiles */}
        <div className="field-group">
          <label className="field-label">Category</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {EXPENSE_CATEGORIES.map(c => {
              const active = category === c;
              const color  = COLORS[c];
              return (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding:'12px 6px', borderRadius:14,
                  border: `1.5px solid ${active ? color+'55' : 'var(--glass-border)'}`,
                  background: active ? color+'22' : 'var(--field-bg)',
                  boxShadow: active ? `0 6px 18px ${color}33` : 'var(--inset)',
                  color: active ? color : 'var(--text-muted)',
                  cursor:'pointer', fontFamily:'var(--font)', fontSize:11, fontWeight:800,
                  textAlign:'center', transition:'all .2s', transform: active ? 'scale(1.04)' : 'none',
                }}>
                  <div style={{ fontSize:22, marginBottom:5 }}>{ICONS[c]}</div>
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">Description</label>
          <input className="field" placeholder="What was this for?" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>

        <div className="field-group">
          <label className="field-label">Amount (QR)</label>
          <input type="number" className="field" placeholder="0" value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ fontFamily:'var(--mono)', fontSize:24, fontWeight:800 }} />
        </div>

        {error && (
          <div style={{ background:'var(--red-dim)', border:'1.5px solid rgba(239,68,68,.2)', borderRadius:10, padding:'11px 14px', fontSize:13, color:'var(--red)', marginBottom:16, fontWeight:600 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display:'flex', gap:12 }}>
          <button className="btn btn-glass" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex:2, justifyContent:'center' }} onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spin">⟳</span>&nbsp;Saving…</> : isEdit ? 'Update Expense ✓' : 'Save Expense ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
