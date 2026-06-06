-- supabase/migrations/001_initial_schema.sql
-- Run this in: Supabase Dashboard → SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- SHOPS
-- ─────────────────────────────────────────
create table if not exists shops (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- Users can only see their own shops
alter table shops enable row level security;
create policy "shops: owner only"
  on shops for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_shops_user on shops(user_id);

-- ─────────────────────────────────────────
-- ENTRIES
-- ─────────────────────────────────────────
create table if not exists entries (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     uuid not null references shops(id) on delete cascade,
  invoice_no  text not null default '',
  order_no    text not null default '',
  type        text not null check (type in ('A', 'D')),
  amount      numeric(12,2) not null default 0,
  advance     numeric(12,2) not null default 0,
  due         numeric(12,2) not null default 0,
  notes       text not null default '',
  entry_date  date not null default current_date,
  created_at  timestamptz not null default now()
);

alter table entries enable row level security;
create policy "entries: shop owner only"
  on entries for all
  using  (shop_id in (select id from shops where user_id = auth.uid()))
  with check (shop_id in (select id from shops where user_id = auth.uid()));

create index idx_entries_shop     on entries(shop_id);
create index idx_entries_date     on entries(entry_date desc);
create index idx_entries_shop_date on entries(shop_id, entry_date desc);

-- ─────────────────────────────────────────
-- EXPENSES
-- ─────────────────────────────────────────
create table if not exists expenses (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     uuid not null references shops(id) on delete cascade,
  description text not null default '',
  amount      numeric(12,2) not null default 0,
  entry_date  date not null default current_date,
  created_at  timestamptz not null default now()
);

alter table expenses enable row level security;
create policy "expenses: shop owner only"
  on expenses for all
  using  (shop_id in (select id from shops where user_id = auth.uid()))
  with check (shop_id in (select id from shops where user_id = auth.uid()));

create index idx_expenses_shop      on expenses(shop_id);
create index idx_expenses_shop_date on expenses(shop_id, entry_date desc);

-- ─────────────────────────────────────────
-- UPLOAD LOGS  (audit trail for extractions)
-- ─────────────────────────────────────────
create table if not exists upload_logs (
  id            uuid primary key default uuid_generate_v4(),
  shop_id       uuid not null references shops(id) on delete cascade,
  raw_json      jsonb,
  status        text not null check (status in ('success', 'error')),
  error_message text,
  entry_count   int not null default 0,
  expense_count int not null default 0,
  created_at    timestamptz not null default now()
);

alter table upload_logs enable row level security;
create policy "upload_logs: shop owner only"
  on upload_logs for all
  using  (shop_id in (select id from shops where user_id = auth.uid()))
  with check (shop_id in (select id from shops where user_id = auth.uid()));

create index idx_upload_logs_shop on upload_logs(shop_id);

-- ─────────────────────────────────────────
-- HELPER VIEW: shop daily summary
-- ─────────────────────────────────────────
create or replace view shop_daily_summary as
select
  s.id            as shop_id,
  s.name          as shop_name,
  s.user_id,
  e.entry_date,
  count(e.id)                    as entry_count,
  coalesce(sum(e.amount), 0)     as total_sales,
  coalesce(sum(e.advance), 0)    as total_advance,
  coalesce(sum(e.due), 0)        as total_due,
  count(case when e.type = 'A' then 1 end) as a_orders,
  count(case when e.type = 'D' then 1 end) as d_orders
from shops s
left join entries e on e.shop_id = s.id
group by s.id, s.name, s.user_id, e.entry_date;
