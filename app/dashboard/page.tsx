'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EntryForm }      from '@/components/ui/EntryForm';
import { ExpenseForm }    from '@/components/ui/ExpenseForm';
import { DonutChart }     from '@/components/ui/DonutChart';
import { Toast }          from '@/components/ui/Toast';
import { ThemeToggle }    from '@/components/ui/ThemeToggle';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Sparkline }      from '@/components/ui/Sparkline';
import { Money }          from '@/components/ui/Money';
import { SkeletonList }   from '@/components/ui/Skeleton';
import { apiFetch, queueRequest, flushOutbox, outboxCount, type ApiError } from '@/lib/offline';
import { calcDue, applyPayment } from '@/lib/invoiceRules';
import { money } from '@/lib/format';
import type { Shop, Entry, Expense } from '@/types';

type Page   = 'dashboard'|'ledger'|'customers'|'expenses'|'settings';
type Period = 'today'|'week'|'month'|'all';
interface ToastItem { message: string; type:'success'|'error'; id: number; }

const PERIOD: Record<Period, string> = { today:'Today', week:'Week', month:'Month', all:'All' };
const PERIOD_LONG: Record<Period, string> = { today:'Today', week:'This Week', month:'This Month', all:'All time' };
const CHART_COLORS = ['#8b7cff','#30d158','#ff9f0a','#ff453a','#0a84ff','#ff375f','#ff9500','#64d2ff'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function periodDates(p: Period) {
  const d = new Date(); const iso = (x: Date) => x.toISOString().split('T')[0];
  if (p==='today') return { from:iso(d), to:iso(d) };
  if (p==='week')  { const s=new Date(d); s.setDate(d.getDate()-d.getDay()); return { from:iso(s), to:iso(d) }; }
  if (p==='month') return { from:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, to:iso(d) };
  return null;
}

export default function Dashboard() {
  const supabase = createClient();
  const [shops,       setShops]       = useState<Shop[]>([]);
  const [shopIdx,     setShopIdx]     = useState(0);
  const [entries,     setEntries]     = useState<Entry[]>([]);
  const [expenses,    setExpenses]    = useState<Expense[]>([]);
  const [page,        setPage]        = useState<Page>('dashboard');
  const [period,      setPeriod]      = useState<Period>('all');
  const [loading,     setLoading]     = useState(true);
  const [dataLoad,    setDataLoad]    = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [toasts,      setToasts]      = useState<ToastItem[]>([]);
  const [entryForm,   setEntryForm]   = useState(false);
  const [expenseForm, setExpenseForm] = useState(false);
  const [editEntry,   setEditEntry]   = useState<Entry|undefined>();
  const [editExpense, setEditExpense] = useState<Expense|undefined>();
  const [shopMenu,    setShopMenu]    = useState(false);
  const [newShop,     setNewShop]     = useState('');
  const [addingShop,  setAddingShop]  = useState(false);
  const [errMsg,      setErrMsg]      = useState('');
  // new feature state
  const [search,      setSearch]      = useState('');
  const [unpaidOnly,  setUnpaidOnly]  = useState(false);
  const [selectMode,  setSelectMode]  = useState(false);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [online,      setOnline]      = useState(true);
  const [queued,      setQueued]      = useState(0);
  // settings
  const [renameVal,   setRenameVal]   = useState('');
  const [savingName,  setSavingName]  = useState(false);

  const shop     = shops[shopIdx];
  const addToast = useCallback((msg: string, type:'success'|'error') => {
    setToasts(p => [...p, { message:msg, type, id:Date.now()+Math.random() }]);
  }, []);

  // keep the rename field in sync with the selected shop
  useEffect(() => { setRenameVal(shop?.name ?? ''); }, [shop?.id, shop?.name]);

  // ── Boot ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/shops');
        if (!res.ok) { setErrMsg('DB error — run migration SQL in Supabase'); setLoading(false); return; }
        let data: Shop[] = await res.json();
        if (data.length === 0) {
          await Promise.all([
            fetch('/api/shops',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Shop 1'}) }),
            fetch('/api/shops',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Shop 2'}) }),
          ]);
          const r2 = await fetch('/api/shops');
          if (r2.ok) data = await r2.json();
        }
        setShops(data);
      } catch { setErrMsg('Network error'); }
      setLoading(false);
    })();
  }, []);

  // ── Online / offline + outbox flush ───────────────────
  useEffect(() => {
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    setQueued(outboxCount());
    const goOnline = async () => {
      setOnline(true);
      const n = await flushOutbox();
      setQueued(outboxCount());
      if (n > 0) { addToast(`Synced ${n} offline change${n>1?'s':''} ✓`, 'success'); loadData(); }
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load data ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!shop) return;
    setDataLoad(true);
    const dates = periodDates(period);
    const p = new URLSearchParams({ shopId: shop.id });
    if (dates) { p.set('from',dates.from); p.set('to',dates.to); }
    try {
      const [e, x] = await Promise.all([
        apiFetch<Entry[]>(`/api/entries?${p}`),
        apiFetch<Expense[]>(`/api/expenses?${p}`),
      ]);
      setEntries(e); setExpenses(x);
    } catch (err) {
      addToast((err as Error).message || 'Failed to load', 'error');
    }
    setDataLoad(false);
  }, [shop, period, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    if (!online) { await flushOutbox(); setQueued(outboxCount()); }
    await loadData();
    setRefreshing(false);
    addToast('Refreshed ✓', 'success');
  };

  // ── Entry CRUD ────────────────────────────────────────
  const saveEntry = async (data: Partial<Entry>): Promise<{error?:string}> => {
    const isEdit = Boolean(editEntry?.id);
    const method = isEdit ? 'PATCH' : 'POST';
    const body   = isEdit ? { ...data, id:editEntry!.id } : data;
    try {
      const json = await apiFetch<Entry>('/api/entries', { method, body: JSON.stringify(body) });
      if (isEdit) setEntries(p => p.map(e => e.id===editEntry!.id ? json : e));
      else        setEntries(p => [json,...p]);
      setEditEntry(undefined); addToast('Entry saved ✓','success'); return {};
    } catch (err) {
      const e = err as ApiError;
      if (e.offline && !isEdit) {
        queueRequest({ url:'/api/entries', method:'POST', body, label:'New entry' });
        setQueued(outboxCount());
        const temp = { ...(body as Entry), id:'tmp-'+Date.now(), due: (data.due ?? calcDue(Number(data.amount)||0, Number(data.advance)||0)) } as Entry;
        setEntries(p => [temp, ...p]);
        setEditEntry(undefined); addToast('Saved offline — will sync','success'); return {};
      }
      return { error: e.message };
    }
  };
  const patchEntry = async (id: string, patch: Partial<Entry>) => {
    try {
      const json = await apiFetch<Entry>('/api/entries', { method:'PATCH', body: JSON.stringify({ id, ...patch }) });
      setEntries(p => p.map(e => e.id===id ? json : e));
      return true;
    } catch (err) { addToast((err as Error).message, 'error'); return false; }
  };
  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try { await apiFetch('/api/entries', { method:'DELETE', body: JSON.stringify({id}) }); setEntries(p => p.filter(e => e.id!==id)); addToast('Deleted','success'); }
    catch (err) { addToast((err as Error).message, 'error'); }
  };
  const markPaid = async (e: Entry) => {
    const ok = await patchEntry(e.id, { advance: Number(e.amount), due: 0 });
    if (ok) addToast(`${e.invoice_no||'Entry'} marked paid ✓`, 'success');
  };

  // ── Expense CRUD ──────────────────────────────────────
  const saveExpense = async (data: Partial<Expense>): Promise<{error?:string}> => {
    const isEdit = Boolean(data.id);
    try {
      const json = await apiFetch<Expense>('/api/expenses', { method: isEdit?'PATCH':'POST', body: JSON.stringify(data) });
      if (isEdit) setExpenses(p => p.map(e => e.id===data.id ? json : e));
      else        setExpenses(p => [json,...p]);
      setEditExpense(undefined); addToast('Expense saved ✓','success'); return {};
    } catch (err) {
      const e = err as ApiError;
      if (e.offline && !isEdit) {
        queueRequest({ url:'/api/expenses', method:'POST', body:data, label:'New expense' });
        setQueued(outboxCount());
        setExpenses(p => [{ ...(data as Expense), id:'tmp-'+Date.now() } as Expense, ...p]);
        addToast('Saved offline — will sync','success'); return {};
      }
      return { error: e.message };
    }
  };
  const deleteExpense = async (id: string) => {
    if (!confirm('Delete?')) return;
    try { await apiFetch('/api/expenses', { method:'DELETE', body: JSON.stringify({id}) }); setExpenses(p => p.filter(e => e.id!==id)); addToast('Deleted','success'); }
    catch (err) { addToast((err as Error).message, 'error'); }
  };

  // ── Bulk actions ──────────────────────────────────────
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  const bulkDelete = async () => {
    if (selected.size===0) return;
    if (!confirm(`Delete ${selected.size} selected entr${selected.size>1?'ies':'y'}?`)) return;
    const ids = [...selected]; let ok = 0;
    for (const id of ids) { try { await apiFetch('/api/entries',{method:'DELETE',body:JSON.stringify({id})}); ok++; } catch {} }
    setEntries(p => p.filter(e => !selected.has(e.id)));
    addToast(`Deleted ${ok} entr${ok>1?'ies':'y'}`, 'success'); exitSelect();
  };
  const bulkMarkPaid = async () => {
    if (selected.size===0) return;
    const targets = entries.filter(e => selected.has(e.id) && Number(e.due)>0);
    let ok = 0;
    for (const e of targets) { if (await patchEntry(e.id, { advance:Number(e.amount), due:0 })) ok++; }
    addToast(`Marked ${ok} paid ✓`, 'success'); exitSelect();
  };

  // ── Customer receivables ──────────────────────────────
  const collectPayment = async (name: string, custEntries: Entry[], outstanding: number) => {
    const amtStr = prompt(`Collect payment from ${name}.\nOutstanding: ${money(outstanding)}\nEnter amount received:`);
    if (amtStr === null) return;
    const amt = parseFloat(amtStr);
    if (!(amt > 0)) { addToast('Enter a valid amount', 'error'); return; }
    const unpaid = custEntries.filter(e => Number(e.due)>0).sort((a,b)=> (a.entry_date||'').localeCompare(b.entry_date||''));
    const updates = applyPayment(unpaid.map(e => ({ id:e.id, due:Number(e.due) })), amt);
    let applied = 0;
    for (const u of updates) {
      const orig = unpaid.find(e => e.id===u.id);
      if (!orig) continue;
      const reduced = Number(orig.due) - u.due;
      if (reduced > 0) { await patchEntry(orig.id, { due:u.due, advance:Number(orig.advance)+reduced }); applied += reduced; }
    }
    addToast(applied>0 ? `Collected ${money(applied)} from ${name} ✓` : 'Nothing outstanding', applied>0?'success':'error');
  };

  // ── Add shop ──────────────────────────────────────────
  const addShop = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newShop.trim()) return; setAddingShop(true);
    try {
      const s = await apiFetch<Shop>('/api/shops', { method:'POST', body: JSON.stringify({name:newShop.trim()}) });
      setShops(p=>[...p,s]); setNewShop(''); addToast(`${s.name} added`,'success');
    } catch (err) { addToast((err as Error).message ?? 'Failed','error'); }
    setAddingShop(false);
  };

  // ── Rename / delete shop (Settings) ───────────────────
  const renameShop = async () => {
    const name = renameVal.trim();
    if (!name || !shop) return;
    if (name === shop.name) return;
    setSavingName(true);
    try {
      const s = await apiFetch<Shop>('/api/shops', { method:'PATCH', body: JSON.stringify({ id: shop.id, name }) });
      setShops(p => p.map((x,i) => i===shopIdx ? s : x));
      addToast('Shop name updated ✓','success');
    } catch (err) { addToast((err as Error).message ?? 'Failed','error'); }
    setSavingName(false);
  };
  const deleteShop = async () => {
    if (!shop) return;
    if (shops.length <= 1) { addToast('Keep at least one shop', 'error'); return; }
    if (!confirm(`Delete "${shop.name}"? This also removes its entries and expenses. This cannot be undone.`)) return;
    try {
      await apiFetch('/api/shops', { method:'DELETE', body: JSON.stringify({ id: shop.id }) });
      setShops(p => p.filter((_,i) => i!==shopIdx));
      setShopIdx(0);
      addToast('Shop deleted','success');
    } catch (err) { addToast((err as Error).message ?? 'Failed','error'); }
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href='/login'; };

  // ── Computed ──────────────────────────────────────────
  const totalSales = entries.reduce((s,e) => s+Number(e.amount),  0);
  const totalAdv   = entries.reduce((s,e) => s+Number(e.advance), 0);
  const totalDue   = entries.reduce((s,e) => s+Number(e.due),     0);
  const totalExp   = expenses.reduce((s,e) => s+Number(e.amount), 0);
  const net        = totalSales - totalExp;

  const catMap: Record<string,number> = {};
  expenses.forEach(e => { catMap[e.category]=(catMap[e.category]||0)+Number(e.amount); });
  const chartSlices = Object.entries(catMap).map(([label,value],i) => ({ label, value, color:CHART_COLORS[i%CHART_COLORS.length] }));
  const topCat = chartSlices.slice().sort((a,b)=>b.value-a.value)[0];

  const salesSeries = useMemo(() => {
    const byDay: Record<string, number> = {};
    entries.forEach(e => { byDay[e.entry_date] = (byDay[e.entry_date]||0) + Number(e.amount); });
    return Object.keys(byDay).sort().map(d => byDay[d]);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(e => {
      if (unpaidOnly && Number(e.due) <= 0) return false;
      if (!q) return true;
      return (e.invoice_no||'').toLowerCase().includes(q) || (e.customer_name||'').toLowerCase().includes(q);
    });
  }, [entries, search, unpaidOnly]);

  const customers = useMemo(() => {
    const map = new Map<string, { name:string; due:number; total:number; unpaid:number; count:number; entries:Entry[] }>();
    entries.forEach(e => {
      const name = (e.customer_name||'').trim() || 'Unnamed';
      const cur = map.get(name) ?? { name, due:0, total:0, unpaid:0, count:0, entries:[] };
      cur.due += Number(e.due); cur.total += Number(e.amount); cur.count++;
      if (Number(e.due) > 0) cur.unpaid++;
      cur.entries.push(e); map.set(name, cur);
    });
    return [...map.values()].sort((a,b) => b.due - a.due);
  }, [entries]);
  const owingCustomers = customers.filter(c => c.due > 0);

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:18 }}>
      <div className="glass" style={{ width:70, height:70, borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span className="spin" style={{ fontSize:28 }}>⟳</span>
      </div>
      <div style={{ color:'var(--text-dim)', fontSize:14, fontWeight:600 }}>Loading Dukan Khata…</div>
    </div>
  );

  const PeriodSeg = () => (
    <div className="segmented" style={{ marginBottom:18 }} role="tablist" aria-label="Time period">
      {(Object.keys(PERIOD) as Period[]).map(p => (
        <button key={p} className={period===p?'active':''} onClick={()=>setPeriod(p)} role="tab" aria-selected={period===p}>{PERIOD[p]}</button>
      ))}
    </div>
  );

  const EmptyNudge = ({ icon, label }: { icon:string; label:string }) => (
    <div className="glass glass-pad pop" style={{ textAlign:'center', padding:'44px 24px' }}>
      <div style={{ fontSize:46, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:13, color:'var(--text-dim)', marginBottom:18 }}>Add your first record to get started.</div>
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
        <button className="btn btn-primary" onClick={()=>{ setEditEntry(undefined); setEntryForm(true); }}>+ New Entry</button>
        <button className="btn btn-glass" onClick={()=>{ setEditExpense(undefined); setExpenseForm(true); }}>+ Expense</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', paddingBottom:120 }}>

      {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={()=>setToasts(p=>p.filter(x=>x.id!==t.id))} />)}
      <EntryForm   open={entryForm}   onClose={()=>{setEntryForm(false);setEditEntry(undefined);}} onSave={saveEntry}   initial={editEntry} shopId={shop?.id??''} />
      <ExpenseForm open={expenseForm} onClose={()=>{setExpenseForm(false);setEditExpense(undefined);}} onSave={saveExpense} initial={editExpense} shopId={shop?.id??''} />

      {/* ── TOP BAR ── */}
      <header style={{
        padding:'10px 12px', display:'flex', alignItems:'center', gap:8, flexWrap:'nowrap',
        background:'var(--nav-bg)', backdropFilter:'blur(16px) saturate(140%)',
        WebkitBackdropFilter:'blur(16px) saturate(140%)', position:'sticky', top:0, zIndex:100,
        borderBottom:'1px solid var(--glass-border)',
      }}>
        {/* Logo — shrinks/truncates, never wraps or overlaps */}
        <div style={{ flex:'1 1 auto', display:'flex', alignItems:'center', gap:9, minWidth:0, overflow:'hidden' }}>
          <div style={{ width:34, height:34, borderRadius:11, background:'var(--accent-grad)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, boxShadow:'0 6px 18px var(--accent-glow)', flexShrink:0 }}>📒</div>
          <div style={{ minWidth:0, overflow:'hidden' }}>
            <div style={{ fontSize:15, fontWeight:800, letterSpacing:-.3, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>Dukan Khata</div>
            <div style={{ fontSize:10.5, color:'var(--text-muted)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {online ? 'Smart Ledger' : <span style={{ color:'var(--amber)' }}>● Offline{queued>0?` · ${queued}`:''}</span>}
            </div>
          </div>
        </div>

        {/* Action cluster — fixed size, never shrinks, sits to the right */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <button onClick={refresh} className="btn-circle" style={{ width:38, height:38, fontSize:15, flexShrink:0 }} aria-label="Refresh data" title="Refresh">
            <span className={refreshing?'spin':''}>⟳</span>
          </button>

          <div style={{ position:'relative', flexShrink:0 }}>
            <button onClick={(e)=>{e.stopPropagation();setShopMenu(p=>!p);}} className="btn-glass" style={{ gap:6, padding:'8px 12px', fontSize:13 }} aria-haspopup="listbox" aria-expanded={shopMenu} aria-label="Switch shop">
              <div className="pulse-dot" style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
              <span style={{ maxWidth:64, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shop?.name??'Shop'}</span>
              <span style={{ fontSize:9, color:'var(--text-muted)' }}>▼</span>
            </button>
            {shopMenu && (
              <div className="glass-strong" role="listbox" style={{ position:'absolute', right:0, top:'calc(100% + 8px)', borderRadius:16, overflow:'hidden', minWidth:170, zIndex:300, animation:'pop .3s var(--ease-spring)' }}>
                {shops.map((s,i) => (
                  <div key={s.id} role="option" aria-selected={shopIdx===i} onClick={()=>{setShopIdx(i);setShopMenu(false);}} style={{
                    padding:'13px 16px', cursor:'pointer', fontSize:13.5, fontWeight:700,
                    background: shopIdx===i ? 'var(--accent-glow)' : 'transparent',
                    color: shopIdx===i ? 'var(--accent)' : 'var(--text)',
                    display:'flex', alignItems:'center', gap:9, borderBottom:'1px solid var(--glass-border)',
                  }}>
                    <div style={{ width:8,height:8,borderRadius:'50%', background:shopIdx===i?'var(--accent)':'var(--text-muted)' }}/>
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={()=>setPage('settings')} className="btn-circle" style={{ width:38, height:38, fontSize:16, flexShrink:0 }} aria-label="Settings" title="Settings">⚙️</button>
        </div>
      </header>

      <div style={{ padding:'18px 16px', maxWidth:680, margin:'0 auto' }} onClick={()=>setShopMenu(false)}>

        {errMsg && (
          <div className="glass" style={{ padding:'14px 16px', marginBottom:16, color:'var(--red)', fontSize:13, fontWeight:600, border:'1px solid color-mix(in srgb,var(--red) 30%,transparent)' }}>
            ⚠ {errMsg} — Go to Supabase → SQL Editor → run the migration.
          </div>
        )}

        {/* ══ DASHBOARD ══════════════════════════════════════ */}
        {page==='dashboard' && (
          <div key="dash" className="page-enter">
            <div style={{ marginBottom:18 }}>
              <div className="page-sub" style={{ marginTop:0 }}>{greeting()} 👋</div>
              <div className="page-title">Dashboard</div>
              <div className="page-sub">{shop?.name} · {PERIOD_LONG[period]}</div>
            </div>
            <PeriodSeg />

            <div className="glass glass-pad rise" style={{ marginBottom:14, overflow:'hidden', position:'relative' }}>
              <div style={{ position:'absolute', inset:0, background:net>=0?'radial-gradient(120% 100% at 0% 0%, var(--green-dim), transparent 60%)':'radial-gradient(120% 100% at 0% 0%, var(--red-dim), transparent 60%)', pointerEvents:'none' }} />
              <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:800, letterSpacing:1.1, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:8 }}>Net Profit</div>
                  <AnimatedNumber value={net} style={{ fontFamily:'var(--mono)', fontSize:32, fontWeight:700, color: net>=0?'var(--green)':'var(--red)', letterSpacing:-1, whiteSpace:'nowrap' }} />
                  <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:6, fontWeight:600 }}>{entries.length} entries · {expenses.length} expenses</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <Sparkline data={salesSeries} color={net>=0?'var(--green)':'var(--red)'} width={120} height={46} />
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, marginTop:4 }}>SALES TREND</div>
                </div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              {[
                { cls:'green', label:'Sales',    icon:'💰', val:totalSales, color:'var(--green)' },
                { cls:'blue',  label:'Advance',  icon:'📥', val:totalAdv,   color:'var(--blue)'  },
                { cls:'red',   label:'Due',      icon:'⏳', val:totalDue,   color:'var(--red)'   },
                { cls:'amber', label:'Expenses', icon:'💸', val:totalExp,   color:'var(--amber)' },
              ].map((s,i) => (
                <div key={s.label} className={`stat-tile ${s.cls} pop`} style={{ animationDelay:`${i*0.06}s` }}>
                  <div className="orb" />
                  <div className="stat-label"><span>{s.icon}</span>{s.label}</div>
                  <AnimatedNumber value={s.val} className="stat-value" style={{ color:s.color }} />
                </div>
              ))}
            </div>

            {/* Receivables peek */}
            {owingCustomers.length > 0 && (
              <div className="glass glass-pad rise" style={{ marginBottom:14, cursor:'pointer' }} onClick={()=>setPage('customers')} role="button" tabIndex={0}
                onKeyDown={e=>{ if(e.key==='Enter') setPage('customers'); }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:800, letterSpacing:.8, textTransform:'uppercase', color:'var(--text-muted)' }}>Top Receivables</div>
                  <span style={{ fontSize:12, color:'var(--accent)', fontWeight:700 }}>View all →</span>
                </div>
                {owingCustomers.slice(0,3).map(c => (
                  <div key={c.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--glass-border)' }}>
                    <span style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{c.name}</span>
                    <Money value={c.due} style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:800, color:'var(--red)' }} />
                  </div>
                ))}
              </div>
            )}

            <div className="glass glass-pad rise" style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:800, letterSpacing:.8, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:16 }}>Order Breakdown</div>
              {(['A','D'] as const).map(t => {
                const filtered = entries.filter(e=>e.type===t);
                const tot      = filtered.reduce((s,e)=>s+Number(e.amount),0);
                const pct      = totalSales>0 ? Math.round((tot/totalSales)*100) : 0;
                return (
                  <div key={t} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span className={`badge badge-${t.toLowerCase()}`}>{t==='A'?'Advance':'Delivered'}</span>
                        <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>{filtered.length} orders · {pct}%</span>
                      </div>
                      <Money value={tot} style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--text)' }} />
                    </div>
                    <div style={{ height:8, borderRadius:5, background:'var(--field-bg)', boxShadow:'var(--inset)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:5, width:`${pct}%`,
                        background: t==='A' ? 'linear-gradient(90deg,var(--amber),#ffd60a)' : 'linear-gradient(90deg,var(--green),#66e08a)',
                        boxShadow: t==='A' ? '0 0 12px var(--amber)' : '0 0 12px var(--green)', animation:'growBar 1s var(--ease-ios)' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>{setEntryForm(true);setEditEntry(undefined);}}>+ New Entry</button>
              <button className="btn btn-glass" style={{ flex:1 }} onClick={()=>{setEditExpense(undefined);setExpenseForm(true);}}>+ Expense</button>
            </div>
          </div>
        )}

        {/* ══ LEDGER ═══════════════════════════════════════ */}
        {page==='ledger' && (
          <div key="ledger" className="page-enter">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div>
                <div className="page-title">Ledger</div>
                <div className="page-sub">{filteredEntries.length} of {entries.length} · {PERIOD_LONG[period]}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-glass btn-sm" onClick={()=>{ setSelectMode(s=>!s); setSelected(new Set()); }} aria-pressed={selectMode}>{selectMode?'Done':'Select'}</button>
                <button className="btn btn-primary btn-sm" onClick={()=>{setEditEntry(undefined);setEntryForm(true);}}>+ New</button>
              </div>
            </div>
            <PeriodSeg />

            {/* Search + filter */}
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <input className="field" style={{ flex:1, padding:'11px 14px', fontSize:14 }} placeholder="🔍 Search invoice or customer"
                value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search entries" />
              <button className={`btn ${unpaidOnly?'btn-primary':'btn-glass'}`} onClick={()=>setUnpaidOnly(u=>!u)} aria-pressed={unpaidOnly} style={{ whiteSpace:'nowrap' }}>
                {unpaidOnly ? '⏳ Unpaid' : 'Unpaid only'}
              </button>
            </div>

            {dataLoad ? <SkeletonList count={4} />
            : entries.length===0 ? <EmptyNudge icon="📋" label="No entries yet" />
            : filteredEntries.length===0 ? (
              <div className="glass glass-pad" style={{ textAlign:'center', padding:'36px 24px', color:'var(--text-dim)', fontSize:14, fontWeight:600 }}>
                No matches{search?` for “${search}”`:''}{unpaidOnly?' with dues':''}.
              </div>
            ) : (
              <>
                {filteredEntries.map((e,idx) => {
                  const sel = selected.has(e.id);
                  return (
                    <div key={e.id} className={`glass glass-pad entry-card-${e.type.toLowerCase()} rise`} style={{ marginBottom:11, padding:16, animationDelay:`${Math.min(idx*0.04,0.4)}s`, outline: sel?'2px solid var(--accent)':'none' }}
                      onClick={selectMode ? ()=>toggleSelect(e.id) : undefined}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          {selectMode && <input type="checkbox" checked={sel} readOnly aria-label="Select entry" style={{ width:18, height:18 }} />}
                          <span className={`badge badge-${e.type.toLowerCase()}`}>{e.type==='A'?'Advance':'Delivered'}</span>
                          {e.invoice_no && <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:12, color:'var(--text)' }}>{e.invoice_no}</span>}
                          {e.customer_name && <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>· {e.customer_name}</span>}
                          {Number(e.due)<=0 && <span className="badge" style={{ background:'var(--green-dim)', color:'var(--green)' }}>✓ Paid</span>}
                        </div>
                        {!selectMode && (
                          <div style={{ display:'flex', gap:6 }}>
                            {Number(e.due)>0 && <button className="btn btn-glass btn-sm" style={{ padding:'5px 10px', fontSize:11 }} onClick={()=>markPaid(e)} title="Mark fully paid">Mark paid</button>}
                            <button className="btn btn-glass btn-sm" style={{ padding:'5px 11px', fontSize:11 }} onClick={()=>{setEditEntry(e);setEntryForm(true);}} aria-label="Edit entry">Edit</button>
                            <button className="btn btn-danger" style={{ padding:'5px 9px', fontSize:11 }} onClick={()=>deleteEntry(e.id)} aria-label="Delete entry">✕</button>
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex' }}>
                        {[
                          { label:'Amount',  value:Number(e.amount),  color:'var(--text)' },
                          { label:'Advance', value:Number(e.advance), color:'var(--blue)'  },
                          { label:'Due',     value:Number(e.due),     color:Number(e.due)>0?'var(--red)':'var(--green)' },
                        ].map((item,i) => (
                          <div key={i} style={{ flex:1, textAlign:'center', padding:'8px 4px', borderRight:i<2?'1px solid var(--glass-border)':'' }}>
                            <div style={{ fontSize:9, fontWeight:800, letterSpacing:.8, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }}>{item.label}</div>
                            <Money value={item.value} style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:700, color:item.color }} />
                          </div>
                        ))}
                      </div>
                      {(e.notes || e.entry_date) && (
                        <div style={{ marginTop:9, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          {e.notes && <span style={{ fontSize:11, color:'var(--text-muted)' }}>📝 {e.notes}</span>}
                          <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:'auto' }}>{e.entry_date}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="glass-strong glass-pad" style={{ marginTop:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', textAlign:'center' }}>
                    {[['Sales',totalSales,'var(--text)'],['Advance',totalAdv,'var(--blue)'],['Due',totalDue,totalDue>0?'var(--red)':'var(--green)']].map(([l,v,c])=>(
                      <div key={String(l)}>
                        <div style={{ fontSize:9,fontWeight:800,letterSpacing:.8,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5 }}>{String(l)}</div>
                        <AnimatedNumber value={Number(v)} style={{ fontFamily:'var(--mono)',fontSize:14,fontWeight:800,color:String(c) }} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ CUSTOMERS ════════════════════════════════════ */}
        {page==='customers' && (
          <div key="cust" className="page-enter">
            <div style={{ marginBottom:14 }}>
              <div className="page-title">Customers</div>
              <div className="page-sub">Who owes you — {PERIOD_LONG[period]}</div>
            </div>
            <PeriodSeg />

            <div className="glass-strong glass-pad rise" style={{ marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:10,fontWeight:800,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:6 }}>Total Outstanding</div>
                <AnimatedNumber value={totalDue} style={{ fontFamily:'var(--mono)',fontSize:28,fontWeight:800,color:'var(--red)' }} />
              </div>
              <div style={{ fontSize:11,color:'var(--text-muted)',fontWeight:700,textAlign:'right' }}>{owingCustomers.length} owing<br/>{customers.length} total</div>
            </div>

            {dataLoad ? <SkeletonList count={3} />
            : customers.length===0 ? <EmptyNudge icon="🧾" label="No customers yet" />
            : (
              <>
                {customers.map((c,idx) => {
                  const pct = totalDue>0 ? Math.round((c.due/totalDue)*100) : 0;
                  return (
                    <div key={c.name} className="glass glass-pad rise" style={{ marginBottom:11, padding:16, animationDelay:`${Math.min(idx*0.04,0.4)}s` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:c.due>0?10:0 }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>{c.name}</div>
                          <div style={{ fontSize:11.5, color:'var(--text-muted)', fontWeight:600, marginTop:2 }}>
                            {c.count} order{c.count>1?'s':''} · {c.unpaid} unpaid · {money(c.total)} total
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:9, fontWeight:800, letterSpacing:.8, textTransform:'uppercase', color:'var(--text-muted)' }}>Due</div>
                          <Money value={c.due} style={{ fontFamily:'var(--mono)', fontSize:17, fontWeight:800, color:c.due>0?'var(--red)':'var(--green)' }} />
                        </div>
                      </div>
                      {c.due>0 && (
                        <>
                          <div style={{ height:6, borderRadius:4, background:'var(--field-bg)', boxShadow:'var(--inset)', overflow:'hidden', marginBottom:10 }}>
                            <div style={{ height:'100%', width:`${pct}%`, borderRadius:4, background:'linear-gradient(90deg,var(--red),#ff8a80)', boxShadow:'0 0 10px var(--red)', animation:'growBar 1s var(--ease-ios)' }} />
                          </div>
                          <button className="btn btn-primary btn-sm" style={{ width:'100%' }} onClick={()=>collectPayment(c.name, c.entries, c.due)}>💵 Collect payment</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ══ EXPENSES ══════════════════════════════════════ */}
        {page==='expenses' && (
          <div key="exp" className="page-enter">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <div className="page-title">Expenses</div>
                <div className="page-sub">Track business costs</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={()=>{setEditExpense(undefined);setExpenseForm(true);}}>+ New</button>
            </div>
            <PeriodSeg />

            <div className="glass-strong glass-pad rise" style={{ marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:10,fontWeight:800,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:6 }}>Total Spent</div>
                <AnimatedNumber value={totalExp} style={{ fontFamily:'var(--mono)',fontSize:28,fontWeight:800,color:'var(--amber)' }} />
              </div>
              <div style={{ fontSize:11,color:'var(--text-muted)',fontWeight:700 }}>{expenses.length} expenses</div>
            </div>

            {chartSlices.length>0 && (
              <div className="glass glass-pad rise" style={{ marginBottom:14, animationDelay:'.08s' }}>
                <div style={{ fontSize:11,fontWeight:800,letterSpacing:.8,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:18 }}>Category Breakdown</div>
                <div style={{ display:'flex', justifyContent:'center' }}>
                  <DonutChart slices={chartSlices} size={180} />
                </div>
              </div>
            )}

            {dataLoad ? <SkeletonList count={3} />
            : expenses.length===0 ? <EmptyNudge icon="💸" label="No expenses yet" />
            : expenses.map((e,idx) => (
              <div key={e.id} className="glass glass-pad rise" style={{ marginBottom:10, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', animationDelay:`${Math.min(idx*0.04,0.4)}s` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:800, background:'var(--amber-dim)', color:'var(--amber)' }}>{e.category}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{e.entry_date}</span>
                  </div>
                  <div style={{ fontSize:13, color:'var(--text-dim)', fontWeight:600 }}>{e.description||'—'}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Money value={Number(e.amount)} style={{ fontFamily:'var(--mono)', fontWeight:800, color:'var(--amber)', fontSize:15 }} />
                  <button className="btn btn-glass btn-sm" style={{ padding:'5px 10px', fontSize:11 }} onClick={()=>{setEditExpense(e);setExpenseForm(true);}} aria-label="Edit expense">Edit</button>
                  <button className="btn btn-danger" style={{ padding:'5px 9px' }} onClick={()=>deleteExpense(e.id)} aria-label="Delete expense">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ SETTINGS ═════════════════════════════════════ */}
        {page==='settings' && (
          <div key="settings" className="page-enter">
            <div style={{ marginBottom:18 }}>
              <div className="page-title">Settings</div>
              <div className="page-sub">Manage your shops & app</div>
            </div>

            {/* Shop */}
            <div className="glass glass-pad rise" style={{ marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:800,letterSpacing:.8,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:14 }}>Current Shop</div>
              <label className="field-label">Shop name</label>
              <div style={{ display:'flex', gap:10, marginBottom:6 }}>
                <input className="field" style={{ flex:1, fontSize:15, padding:'12px 14px' }} value={renameVal} onChange={e=>setRenameVal(e.target.value)} aria-label="Shop name" placeholder="Shop name" />
                <button className="btn btn-primary" onClick={renameShop} disabled={savingName || !renameVal.trim() || renameVal.trim()===shop?.name}>
                  {savingName ? '…' : 'Save'}
                </button>
              </div>
              {shops.length>1 && (
                <button className="btn btn-danger" style={{ marginTop:10, width:'100%', borderRadius:'var(--radius-pill)', padding:'11px' }} onClick={deleteShop}>
                  🗑 Delete “{shop?.name}” and its data
                </button>
              )}
            </div>

            {/* Add shop */}
            <div className="glass glass-pad rise" style={{ marginBottom:14, animationDelay:'.05s' }}>
              <div style={{ fontSize:11,fontWeight:800,letterSpacing:.8,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:14 }}>Add a Shop <span style={{ fontWeight:600, textTransform:'none', letterSpacing:0 }}>({shops.length}/5)</span></div>
              <form onSubmit={addShop} style={{ display:'flex', gap:10 }}>
                <input className="field" style={{ flex:1,fontSize:14,padding:'12px 14px' }} placeholder="New shop name" value={newShop} onChange={e=>setNewShop(e.target.value)} aria-label="New shop name" />
                <button type="submit" className="btn btn-primary" disabled={addingShop||!newShop.trim()||shops.length>=5}>{addingShop?'…':'+ Add'}</button>
              </form>
            </div>

            {/* Appearance */}
            <div className="glass glass-pad rise" style={{ marginBottom:14, animationDelay:'.1s', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>Appearance</div>
                <div style={{ fontSize:12.5, color:'var(--text-dim)' }}>Switch light / dark theme</div>
              </div>
              <ThemeToggle />
            </div>

            {/* Data & sync */}
            <div className="glass glass-pad rise" style={{ marginBottom:14, animationDelay:'.15s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>Data &amp; Sync</div>
                  <div style={{ fontSize:12.5, color:'var(--text-dim)' }}>
                    {online ? 'Online' : 'Offline'}{queued>0 ? ` · ${queued} change${queued>1?'s':''} waiting` : ' · all synced'}
                  </div>
                </div>
                <div style={{ width:10, height:10, borderRadius:'50%', background: online?'var(--green)':'var(--amber)', boxShadow:`0 0 8px ${online?'var(--green)':'var(--amber)'}` }} />
              </div>
              <button className="btn btn-glass" style={{ width:'100%' }} onClick={refresh} disabled={refreshing}>
                <span className={refreshing?'spin':''}>⟳</span>&nbsp;{refreshing?'Syncing…':'Sync now'}
              </button>
            </div>

            {/* Account */}
            <div className="glass glass-pad rise" style={{ marginBottom:14, animationDelay:'.2s' }}>
              <div style={{ fontSize:11,fontWeight:800,letterSpacing:.8,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:12 }}>Account</div>
              <button className="btn btn-danger" style={{ width:'100%', borderRadius:'var(--radius-pill)', padding:'12px' }} onClick={signOut}>↗ Sign out</button>
            </div>

            {/* About */}
            <div className="glass glass-pad rise" style={{ animationDelay:'.25s', textAlign:'center' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>📒 Dukan Khata</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Version 4 · Currency: Qatari Riyal (QR)</div>
            </div>
          </div>
        )}
      </div>

      {/* ══ BULK ACTION BAR ════════════════════════════════ */}
      {page==='ledger' && selectMode && selected.size>0 && (
        <div className="glass-strong" style={{ position:'fixed', bottom:'calc(92px + env(safe-area-inset-bottom))', left:'50%', transform:'translateX(-50%)', zIndex:210, display:'flex', gap:10, padding:'10px 14px', borderRadius:'var(--radius-pill)', width:'calc(100% - 28px)', maxWidth:460, alignItems:'center', animation:'rise .3s var(--ease-ios)' }}>
          <span style={{ fontSize:13, fontWeight:800, color:'var(--text)', marginLeft:6 }}>{selected.size} selected</span>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            <button className="btn btn-glass btn-sm" onClick={bulkMarkPaid}>✓ Mark paid</button>
            <button className="btn btn-danger btn-sm" onClick={bulkDelete}>🗑 Delete</button>
          </div>
        </div>
      )}

      {/* ══ BOTTOM NAV ════════════════════════════════════════ */}
      <nav className="bottom-nav" aria-label="Primary">
        {[
          { key:'dashboard', icon:'📊', label:'Home'      },
          { key:'ledger',    icon:'📋', label:'Ledger'    },
        ].map(item => (
          <button key={item.key} className={`nav-item${page===item.key?' active':''}`} onClick={()=>setPage(item.key as Page)} aria-current={page===item.key?'page':undefined}>
            <span className="nav-item-icon">{item.icon}</span>{item.label}
          </button>
        ))}

        <div className="nav-fab-wrap">
          <button className="btn-fab" aria-label="Add new" onClick={()=>{
            if (page==='expenses') { setEditExpense(undefined); setExpenseForm(true); }
            else { setEditEntry(undefined); setEntryForm(true); }
          }} title="Add new">+</button>
        </div>

        {[
          { key:'customers', icon:'🧾', label:'Customers' },
          { key:'expenses',  icon:'💸', label:'Expenses'  },
        ].map(item => (
          <button key={item.key} className={`nav-item${page===item.key?' active':''}`} onClick={()=>setPage(item.key as Page)} aria-current={page===item.key?'page':undefined}>
            <span className="nav-item-icon">{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
