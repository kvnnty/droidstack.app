-- Extend devices table for orchestrator + billing
alter table public.devices
  add column if not exists device_name text,
  add column if not exists android_version text default '13',
  add column if not exists cpu int default 2,
  add column if not exists ram int default 2048,
  add column if not exists storage int default 8192,
  add column if not exists container_id text,
  add column if not exists adb_port int,
  add column if not exists novnc_port int;

-- Update status check for new values
alter table public.devices drop constraint if exists devices_status_check;
alter table public.devices add constraint devices_status_check
  check (status in ('starting', 'running', 'stopped', 'error', 'online', 'offline', 'busy'));

-- Backfill device_name from name
update public.devices set device_name = name where device_name is null;

-- Stripe customers (link auth user to Stripe)
create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz default now()
);

-- Stripe subscriptions
create table if not exists public.stripe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'unpaid')),
  device_limit int not null default 1,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Audit logs for device actions
create table if not exists public.device_audit_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.stripe_customers enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.device_audit_logs enable row level security;

create policy "Users view own stripe_customers" on public.stripe_customers for select using (auth.uid() = user_id);
create policy "Users view own stripe_subscriptions" on public.stripe_subscriptions for select using (auth.uid() = user_id);
create policy "Users view own device_audit_logs" on public.device_audit_logs for select using (
  exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
);

create index idx_devices_container_id on public.devices (container_id);
create index idx_devices_status_new on public.devices (status);
create index idx_device_audit_logs_device_id on public.device_audit_logs (device_id);
