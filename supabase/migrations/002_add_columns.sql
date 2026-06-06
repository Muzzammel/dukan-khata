-- Run this in Supabase SQL Editor AFTER the first migration (001)
ALTER TABLE entries  ADD COLUMN IF NOT EXISTS customer_name text not null default '';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category      text not null default 'Other';
