'use client';
import { useState, useEffect } from 'react';
import type { Entry, EntryType } from '@/types';

interface Props {
  open: boolean; onClose: () => void;
  onSave: (data: Partial<Entry>) => Promise<{ error?: string }>;
  initial?: Partial<Entry>; shopId: string;
}
const today = () => new Date().toISOString().split('T')[0];

export function EntryForm({ open, onClose, onSave, initial, shopId }: Props) {
  const [date,     setDate]     = useState(today());
  const [type,     setType]     = useState<EntryType>('A');
  const [invoice,  setInvoice]  = useState('');
  const [order,    setOrder]    = useState('1');
  const [customer, setCustomer] = useState('');
  const [amount,   setAmount]   = useState('');
  const [advance,  setAdvance]  = useState('');
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const due = Math.max(0, (parseFloat(amount)||0) - (parseFloat(advance)||0));

  useEffect(() => {
    if (!open) return;
    setDate(initial?.entry_date ?? today()); setType(initial?.type ?? 'A');
    setInvoice(initial?.invoice_no ?? ''); setOrder(initial?.order_no ?? '1');
    setCustomer(initial?.customer_name ?? '');
    setAmount(initial?.amount  ? String(initial.amount)  : '');
    setAdvance(initial?.advance ? String(initial.advance) : '');
    setNotes(initial?.notes ?? ''); setError('');
  }, [open, initial]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError('Total amount is required'); return; }
    setSaving(true); setError('');
    const res = await onSave({
      shop_id: shopId, entry_date: date, type,
      invoice_no: invoice, order_no: order, customer_name: customer,
      amount: parseFloat(amount)||0, advance: parseFloat(advance)||0, due, notes,
    });
    setSaving(false);
    if (res?.error) setError(res.error); else onClose();
  };

  if (!open) return null;

  const typeStyle = (t: EntryType) => ({
    flex:1, padding:'12px 8px', borderRadius:12,
    border: `1.5px solid ${type===t ? (t==='A' ? 'var(--amber)' : 'var(--green)') : 'var(--glass-border)'}`,
    background: type===t ? (t==='A' ? 'var(--amber-dim)' : 'var(--green-dim)') : 'var(--field-bg)',
    color: type===t ? (t==='A' ? 'var(--amber)' : 'var(--green)') : 'var(--text-dim)',
    cursor:'pointer', fontFamily:'var(--font)', fontWeight:800, fontSize:13,
    boxShadow: type===t ? 'none' : 'var(--inset)',
    transition:'all .2s', textAlign:'center' as const,
  });

  return (
    <div className="modal-backdrop open" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-title">{initial?.id ? '✏️ Edit Entry' : '+ New Ledger Entry'}</div>

        {/* Type selector — visual toggle */}
        <div className="field-group">
          <label className="field-label">Type</label>
          <div style={{ display:'flex', gap:10 }}>
            <button style={typeStyle('A')} onClick={() => setType('A')}>
              <div style={{ fontSize:20, marginBottom:4 }}>💰</div>
              Advance (A)
              <div style={{ fontSize:10, fontWeight:600, opacity:.7, marginTop:2 }}>Payment received</div>
            </button>
            <button style={typeStyle('D')} onClick={() => setType('D')}>
              <div style={{ fontSize:20, marginBottom:4 }}>✅</div>
              Delivered (D)
              <div style={{ fontSize:10, fontWeight:600, opacity:.7, marginTop:2 }}>Order complete</div>
            </button>
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">Date</label>
          <input type="date" className="field" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="field-group">
            <label className="field-label">Invoice No.</label>
            <input className="field" placeholder="INV-001" value={invoice} onChange={e => setInvoice(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Order No.</label>
            <input className="field" placeholder="1" value={order} onChange={e => setOrder(e.target.value)} />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">Customer Name</label>
          <input className="field" placeholder="Optional" value={customer} onChange={e => setCustomer(e.target.value)} />
        </div>

        <div className="field-group">
          <label className="field-label">Total Amount (QR)</label>
          <input type="number" className="field" placeholder="0" value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:700 }} />
        </div>

        <div className="field-group">
          <label className="field-label">Advance Paid (QR)</label>
          <input type="number" className="field" placeholder="0" value={advance}
            onChange={e => setAdvance(e.target.value)}
            style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:700, color:'var(--blue)' }} />
        </div>

        {/* Due — auto-calculated display */}
        <div className="field-group">
          <label className="field-label">Due Amount — Auto-calculated</label>
          <div style={{
            padding:'14px 16px', borderRadius:12, fontSize:22, fontFamily:'var(--mono)', fontWeight:800,
            color: due>0 ? 'var(--red)' : 'var(--green)',
            background: due>0 ? 'var(--red-dim)' : 'var(--green-dim)',
            border: `1.5px solid ${due>0 ? 'rgba(239,68,68,.2)' : 'rgba(16,185,129,.2)'}`,
            boxShadow: 'var(--inset)',
          }}>
            QR {due.toLocaleString('en-US')}
            <span style={{ fontSize:11, fontFamily:'var(--font)', fontWeight:600, opacity:.6, marginLeft:8 }}>
              {due===0 ? 'fully paid' : 'remaining'}
            </span>
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">Notes</label>
          <textarea className="field" placeholder="Optional notes…" rows={2} value={notes}
            onChange={e => setNotes(e.target.value)} style={{ resize:'none' }} />
        </div>

        {error && (
          <div style={{ background:'var(--red-dim)', border:'1.5px solid rgba(239,68,68,.2)', borderRadius:10, padding:'11px 14px', fontSize:13, color:'var(--red)', marginBottom:16, fontWeight:600 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display:'flex', gap:12 }}>
          <button className="btn btn-glass" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex:2, justifyContent:'center' }} onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spin">⟳</span>&nbsp;Saving…</> : 'Save Entry ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
