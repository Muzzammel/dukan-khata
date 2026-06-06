import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkInvoiceRule, calcDue } from '@/lib/invoiceRules';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get('shopId');
  const from   = searchParams.get('from');
  const to     = searchParams.get('to');
  if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 });

  let q = supabase.from('entries').select('*').eq('shop_id', shopId)
    .order('entry_date', { ascending: false })
    .order('created_at',  { ascending: false });

  if (from) q = q.gte('entry_date', from);
  if (to)   q = q.lte('entry_date', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { shop_id, invoice_no, order_no, customer_name, type,
          amount, advance, due, notes, entry_date } = body;

  if (!shop_id || !type) return NextResponse.json({ error: 'shop_id and type required' }, { status: 400 });
  if (!['A','D'].includes(type)) return NextResponse.json({ error: 'type must be A or D' }, { status: 400 });

  // Duplicate invoice rule (Type A / Type D) — see lib/invoiceRules.ts
  if (invoice_no?.trim()) {
    const { data: existing } = await supabase
      .from('entries').select('id,type,due')
      .eq('shop_id', shop_id).eq('invoice_no', invoice_no.trim());

    const verdict = checkInvoiceRule(type, invoice_no, (existing ?? []) as { type: 'A'|'D'; due: number }[]);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status ?? 409 });
    }
  }

  const amt  = Number(amount)  || 0;
  const adv  = Number(advance) || 0;
  const finalDue = due !== undefined ? Number(due) : calcDue(amt, adv);

  const { data, error } = await supabase.from('entries').insert({
    shop_id,
    invoice_no:    invoice_no    ?? '',
    order_no:      order_no      ?? '',
    customer_name: customer_name ?? '',
    type,
    amount:     amt,
    advance:    adv,
    due:        finalDue,
    notes:      notes      ?? '',
    entry_date: entry_date ?? new Date().toISOString().split('T')[0],
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  delete updates.shop_id; delete updates.created_at;

  // Recalculate due if amount/advance changed
  if (updates.amount !== undefined || updates.advance !== undefined) {
    const { data: ex } = await supabase.from('entries').select('amount,advance').eq('id', id).single();
    if (ex && updates.due === undefined) {
      const a = updates.amount  !== undefined ? Number(updates.amount)  : Number(ex.amount);
      const b = updates.advance !== undefined ? Number(updates.advance) : Number(ex.advance);
      updates.due = Math.max(0, a - b);
    }
  }

  const { data, error } = await supabase.from('entries').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
