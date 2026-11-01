-- ============================================================
-- Toku Takoyaki — Staff & Roles (staff_users table + seed)
-- Run this once in the Supabase SQL Editor (Studio > SQL).
-- ============================================================

create table if not exists public.staff_users (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text not null unique,
  password      text not null,
  password_hash text,
  role          text not null default 'Staff' check (role in ('Admin', 'Staff')),
  created_at    timestamptz not null default now()
);

alter table public.staff_users enable row level security;

drop policy if exists "staff_users_select" on public.staff_users;
drop policy if exists "staff_users_insert" on public.staff_users;
drop policy if exists "staff_users_update" on public.staff_users;
drop policy if exists "staff_users_delete" on public.staff_users;

create policy "staff_users_select" on public.staff_users for select using (true);
create policy "staff_users_insert" on public.staff_users for insert with check (true);
create policy "staff_users_update" on public.staff_users for update using (true) with check (true);
create policy "staff_users_delete" on public.staff_users for delete using (true);

-- Default admin account (password: admin123 — SHA-256 stored)
insert into public.staff_users (full_name, email, password, password_hash, role)
values (
  'System Administrator',
  'admin@toku.local',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'Admin'
)
on conflict (email) do update set password = excluded.password;
