import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? 'all';
  const from   = searchParams.get('from');
  const to     = searchParams.get('to');

  let resolvedFrom = from;
  let resolvedTo   = to;

  if (!from && !to) {
    const d   = new Date();
    const fmt = (x: Date) => x.toISOString().split('T')[0];
    if (period === 'today') {
      resolvedFrom = fmt(d); resolvedTo = fmt(d);
    } else if (period === 'week') {
      const s = new Date(d); s.setDate(d.getDate() - d.getDay());
      resolvedFrom = fmt(s); resolvedTo = fmt(d);
    } else if (period === 'month') {
      resolvedFrom = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
      resolvedTo   = fmt(d);
    }
  }

  const { data: shops } = await supabase
    .from('shops').select('*').eq('user_id', user.id).order('created_at');

  const summaries = await Promise.all((shops ?? []).map(async shop => {
    let eq = supabase.from('entries').select('amount,advance,due,type').eq('shop_id', shop.id);
    let xq = supabase.from('expenses').select('amount,category').eq('shop_id', shop.id);
    if (resolvedFrom) { eq = eq.gte('entry_date', resolvedFrom); xq = xq.gte('entry_date', resolvedFrom); }
    if (resolvedTo)   { eq = eq.lte('entry_date', resolvedTo);   xq = xq.lte('entry_date', resolvedTo);   }

    const [{ data: entries }, { data: expenses }] = await Promise.all([eq, xq]);

    const totalSales    = (entries  ?? []).reduce((s,e) => s + Number(e.amount),  0);
    const totalAdvance  = (entries  ?? []).reduce((s,e) => s + Number(e.advance), 0);
    const totalDue      = (entries  ?? []).reduce((s,e) => s + Number(e.due),     0);
    const totalExpenses = (expenses ?? []).reduce((s,e) => s + Number(e.amount),  0);
    const aOrders       = (entries  ?? []).filter(e => e.type === 'A').length;
    const dOrders       = (entries  ?? []).filter(e => e.type === 'D').length;

    // Category breakdown
    const catMap: Record<string, number> = {};
    (expenses ?? []).forEach(e => { catMap[e.category] = (catMap[e.category]||0) + Number(e.amount); });

    return {
      shop, totalSales, totalAdvance, totalDue, totalExpenses,
      net: totalSales - totalExpenses,
      entryCount: (entries ?? []).length,
      aOrders, dOrders, catMap,
    };
  }));

  const combined = {
    totalSales:    summaries.reduce((s,x) => s + x.totalSales,    0),
    totalAdvance:  summaries.reduce((s,x) => s + x.totalAdvance,  0),
    totalDue:      summaries.reduce((s,x) => s + x.totalDue,      0),
    totalExpenses: summaries.reduce((s,x) => s + x.totalExpenses, 0),
    net:           summaries.reduce((s,x) => s + x.net,           0),
    entryCount:    summaries.reduce((s,x) => s + x.entryCount,    0),
  };

  return NextResponse.json({ shops: summaries, combined });
}
