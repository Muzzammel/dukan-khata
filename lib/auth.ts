// lib/auth.ts
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

/** Use in server components/pages that require auth */
export async function requireAuth(): Promise<User> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return user;
}

/** Use in API routes that require auth */
export async function getUserFromRequest(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}
