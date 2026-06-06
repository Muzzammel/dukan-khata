// app/api/shops/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  // Limit: max 5 shops per user
  const { count } = await supabase.from('shops').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) >= 5) return NextResponse.json({ error: 'Maximum 5 shops allowed' }, { status: 400 });

  const { data, error } = await supabase
    .from('shops')
    .insert({ name: name.trim(), user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, name } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('shops')
    .update({ name: name.trim() })
    .eq('id', id).eq('user_id', user.id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Keep at least one shop per user.
  const { count } = await supabase.from('shops').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) <= 1) return NextResponse.json({ error: 'You must keep at least one shop' }, { status: 400 });

  // Remove the shop's data first (in case there's no ON DELETE CASCADE).
  await supabase.from('entries').delete().eq('shop_id', id);
  await supabase.from('expenses').delete().eq('shop_id', id);

  const { error } = await supabase.from('shops').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
