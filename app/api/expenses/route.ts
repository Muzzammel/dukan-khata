import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get('shopId');
  const from   = searchParams.get('from');
  const to     = searchParams.get('to');
  if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 });

  let q = supabase.from('expenses').select('*').eq('shop_id', shopId)
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

  const { shop_id, category, description, amount, entry_date } = await request.json();
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 });

  const { data, error } = await supabase.from('expenses').insert({
    shop_id,
    category:    category    ?? 'Other',
    description: description ?? '',
    amount:      Number(amount) || 0,
    entry_date:  entry_date  ?? new Date().toISOString().split('T')[0],
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

  const { data, error } = await supabase.from('expenses').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
