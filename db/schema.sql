-- Run this in Supabase SQL editor once after creating the project.
-- Creates profiles + engagements + notes tables with row-level security.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  spotify_user_id text,
  created_at timestamptz default now()
);

create table if not exists public.engagements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_date date not null,
  kind text not null check (kind in ('opened', 'played', 'favorited', 'dismissed')),
  created_at timestamptz default now(),
  unique (user_id, song_date, kind)
);

create index if not exists engagements_user_song_idx on public.engagements (user_id, song_date);
create index if not exists engagements_user_kind_idx on public.engagements (user_id, kind);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_date date not null,
  body text not null,
  updated_at timestamptz default now(),
  unique (user_id, song_date)
);

alter table public.profiles enable row level security;
alter table public.engagements enable row level security;
alter table public.notes enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles upsert own" on public.profiles;
create policy "profiles upsert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "engagements read own" on public.engagements;
create policy "engagements read own" on public.engagements
  for select using (auth.uid() = user_id);

drop policy if exists "engagements insert own" on public.engagements;
create policy "engagements insert own" on public.engagements
  for insert with check (auth.uid() = user_id);

drop policy if exists "engagements delete own" on public.engagements;
create policy "engagements delete own" on public.engagements
  for delete using (auth.uid() = user_id);

drop policy if exists "notes read own" on public.notes;
create policy "notes read own" on public.notes
  for select using (auth.uid() = user_id);

drop policy if exists "notes upsert own" on public.notes;
create policy "notes upsert own" on public.notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "notes update own" on public.notes;
create policy "notes update own" on public.notes
  for update using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, spotify_user_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'provider_id'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
