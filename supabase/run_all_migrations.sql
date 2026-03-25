-- Combines all migrations in order. Safe to run if some tables already exist.

-- ========== 1. Profiles ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========== 2. Devices schema ==========
create table if not exists public.device_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid references public.device_groups (id) on delete set null,
  name text not null,
  device_serial text unique,
  type text not null default 'emulator' check (type in ('emulator', 'physical')),
  status text not null default 'offline' check (status in ('online', 'offline', 'busy', 'error')),
  os_version text,
  metadata jsonb default '{}',
  battery_level int check (battery_level is null or (battery_level >= 0 and battery_level <= 100)),
  last_seen_at timestamptz,
  agent_token text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.device_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  command_type text not null,
  payload jsonb default '{}',
  target_type text not null check (target_type in ('device', 'group')),
  target_ids uuid[] not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'partial')),
  result jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.device_alerts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  alert_type text not null check (alert_type in ('low_battery', 'offline', 'error', 'high_temp')),
  message text,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  token text not null,
  platform text default 'android',
  created_at timestamptz default now(),
  unique(device_id, token)
);

alter table public.device_groups enable row level security;
alter table public.devices enable row level security;
alter table public.device_commands enable row level security;
alter table public.device_alerts enable row level security;
alter table public.device_push_tokens enable row level security;

drop policy if exists "Users manage own device_groups" on public.device_groups;
create policy "Users manage own device_groups" on public.device_groups for all using (auth.uid() = user_id);

drop policy if exists "Users manage own devices" on public.devices;
create policy "Users manage own devices" on public.devices for all using (auth.uid() = user_id);

drop policy if exists "Users manage own device_commands" on public.device_commands;
create policy "Users manage own device_commands" on public.device_commands for all using (auth.uid() = user_id);

drop policy if exists "Users view own device_alerts" on public.device_alerts;
create policy "Users view own device_alerts" on public.device_alerts for select using (
  exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
);
drop policy if exists "Users update own device_alerts" on public.device_alerts;
create policy "Users update own device_alerts" on public.device_alerts for update using (
  exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
);

drop policy if exists "Users manage own device_push_tokens" on public.device_push_tokens;
create policy "Users manage own device_push_tokens" on public.device_push_tokens for all using (
  exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
);

create index if not exists idx_devices_user_id on public.devices (user_id);
create index if not exists idx_devices_status on public.devices (status);
create index if not exists idx_devices_group_id on public.devices (group_id);
create index if not exists idx_device_alerts_device_id on public.device_alerts (device_id);
create index if not exists idx_device_alerts_resolved on public.device_alerts (resolved_at) where resolved_at is null;

-- ========== 3. Orchestrator + billing ==========
alter table public.devices
  add column if not exists device_name text,
  add column if not exists android_version text default '13',
  add column if not exists cpu int default 2,
  add column if not exists ram int default 2048,
  add column if not exists storage int default 8192,
  add column if not exists container_id text,
  add column if not exists adb_port int,
  add column if not exists novnc_port int;

alter table public.devices drop constraint if exists devices_status_check;
alter table public.devices add constraint devices_status_check
  check (status in ('starting', 'running', 'stopped', 'error', 'online', 'offline', 'busy'));

update public.devices set device_name = name where device_name is null;

create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz default now()
);

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

drop policy if exists "Users view own stripe_customers" on public.stripe_customers;
create policy "Users view own stripe_customers" on public.stripe_customers for select using (auth.uid() = user_id);

drop policy if exists "Users view own stripe_subscriptions" on public.stripe_subscriptions;
create policy "Users view own stripe_subscriptions" on public.stripe_subscriptions for select using (auth.uid() = user_id);

drop policy if exists "Users view own device_audit_logs" on public.device_audit_logs;
create policy "Users view own device_audit_logs" on public.device_audit_logs for select using (
  exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
);

create index if not exists idx_devices_container_id on public.devices (container_id);
create index if not exists idx_devices_status_new on public.devices (status);
create index if not exists idx_device_audit_logs_device_id on public.device_audit_logs (device_id);
