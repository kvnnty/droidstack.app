-- Organizations / teams: membership, invitations, per-member device access.

-- ---------- Core tables ----------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_personal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create unique index if not exists organization_members_one_owner_per_org
  on public.organization_members (organization_id)
  where role = 'owner';

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token text not null unique,
  device_ids jsonb not null default '[]',
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_invites_org_email
  on public.organization_invitations (organization_id, lower(email));

-- Explicit device access for members (owners/admins implicitly have all devices in the org).
create table if not exists public.organization_member_device_access (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, device_id)
);

-- ---------- Extend devices & groups ----------
alter table public.devices
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

alter table public.device_groups
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

create index if not exists idx_devices_organization_id on public.devices (organization_id);
create index if not exists idx_device_groups_organization_id on public.device_groups (organization_id);

-- ---------- Backfill: one personal org per existing user ----------
insert into public.organizations (name, slug, is_personal)
select
  coalesce(
    nullif(trim(p.display_name), ''),
    split_part(u.email, '@', 1),
    'Workspace'
  ) || '''s workspace',
  'personal-' || replace(u.id::text, '-', ''),
  true
from auth.users u
left join public.profiles p on p.id = u.id
where not exists (
  select 1 from public.organization_members m where m.user_id = u.id
);

insert into public.organization_members (organization_id, user_id, role)
select o.id, u.id, 'owner'
from auth.users u
join public.organizations o on o.slug = 'personal-' || replace(u.id::text, '-', '')
where not exists (
  select 1 from public.organization_members m where m.user_id = u.id and m.organization_id = o.id
);

-- Attach devices & groups to an org the owner belongs to (personal slug preferred)
update public.devices d
set organization_id = coalesce(
  (select o.id from public.organizations o where o.slug = 'personal-' || replace(d.user_id::text, '-', '') limit 1),
  (select m.organization_id from public.organization_members m where m.user_id = d.user_id order by case when m.role = 'owner' then 0 else 1 end limit 1)
)
where d.organization_id is null;

update public.device_groups dg
set organization_id = coalesce(
  (select o.id from public.organizations o where o.slug = 'personal-' || replace(dg.user_id::text, '-', '') limit 1),
  (select m.organization_id from public.organization_members m where m.user_id = dg.user_id order by case when m.role = 'owner' then 0 else 1 end limit 1)
)
where dg.organization_id is null;

-- New devices/groups must belong to an org (existing rows without devices get org on signup trigger only).
alter table public.devices
  alter column organization_id set not null;

alter table public.device_groups
  alter column organization_id set not null;

-- ---------- Signup: default personal org ----------
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_org_id uuid;
  base_name text;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );

  base_name := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')), ''),
    split_part(new.email, '@', 1),
    'Workspace'
  );

  insert into public.organizations (name, slug, is_personal)
  values (
    base_name || '''s workspace',
    'personal-' || replace(new.id::text, '-', ''),
    true
  )
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer;

-- ---------- RLS (direct Supabase client usage) ----------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_member_device_access enable row level security;

drop policy if exists "Users see orgs they belong to" on public.organizations;
create policy "Users see orgs they belong to"
  on public.organizations for select using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own memberships" on public.organization_members;
create policy "Users see own memberships"
  on public.organization_members for select using (user_id = auth.uid());

drop policy if exists "Invitees see invites by email" on public.organization_invitations;
drop policy if exists "Users see invites for their email" on public.organization_invitations;
create policy "Users see invites for their email"
  on public.organization_invitations for select using (
    lower(trim(email)) = lower(trim(coalesce(auth.jwt()->>'email', '')))
  );

drop policy if exists "Device access visible to member" on public.organization_member_device_access;
create policy "Device access visible to member"
  on public.organization_member_device_access for select using (user_id = auth.uid());
