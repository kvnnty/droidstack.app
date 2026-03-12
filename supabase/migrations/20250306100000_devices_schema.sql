-- Device groups (user-owned)
create table if not exists public.device_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Devices (emulator or physical)
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

-- Bulk commands (target devices or groups)
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

-- Device alerts (low battery, offline, etc.)
create table if not exists public.device_alerts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  alert_type text not null check (alert_type in ('low_battery', 'offline', 'error', 'high_temp')),
  message text,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Push notification tokens (for FCM or similar)
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  token text not null,
  platform text default 'android',
  created_at timestamptz default now(),
  unique(device_id, token)
);

-- RLS
alter table public.device_groups enable row level security;
alter table public.devices enable row level security;
alter table public.device_commands enable row level security;
alter table public.device_alerts enable row level security;
alter table public.device_push_tokens enable row level security;

-- Policies: users can only access their own data
create policy "Users manage own device_groups"
  on public.device_groups for all using (auth.uid() = user_id);

create policy "Users manage own devices"
  on public.devices for all using (auth.uid() = user_id);

create policy "Users manage own device_commands"
  on public.device_commands for all using (auth.uid() = user_id);

create policy "Users view own device_alerts"
  on public.device_alerts for select using (
    exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
  );
create policy "Users update own device_alerts"
  on public.device_alerts for update using (
    exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
  );

create policy "Users manage own device_push_tokens"
  on public.device_push_tokens for all using (
    exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid())
  );

-- Indexes
create index idx_devices_user_id on public.devices (user_id);
create index idx_devices_status on public.devices (status);
create index idx_devices_group_id on public.devices (group_id);
create index idx_device_alerts_device_id on public.device_alerts (device_id);
create index idx_device_alerts_resolved on public.device_alerts (resolved_at) where resolved_at is null;
