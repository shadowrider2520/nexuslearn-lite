-- NexusLearn Lite — initial schema
-- Apply in the Supabase SQL Editor, or with the CLI: supabase db push
--
-- Note: if you already created these tables in the Supabase dashboard,
-- this file documents the canonical schema and is safe to run on a fresh project.

-- ============================================================
-- TABLES
-- ============================================================

-- User profiles (username set after signup)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

-- Study rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Room membership
create table if not exists public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- AI-generated roadmaps (steps stored as jsonb: [{ id, day, title, description, estimated_minutes }])
create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  topic text not null,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Per-member step completion
create table if not exists public.progress (
  room_id uuid not null references public.rooms (id) on delete cascade,
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  step_id integer not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key (roadmap_id, step_id, user_id)
);

-- Generated tasks per roadmap step (items stored as jsonb: [{ id, type, title, description }])
create table if not exists public.tasks (
  room_id uuid not null references public.rooms (id) on delete cascade,
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  step_id integer not null,
  items jsonb not null default '[]'::jsonb,
  primary key (roadmap_id, step_id)
);

-- Per-member task completion
create table if not exists public.task_progress (
  room_id uuid not null references public.rooms (id) on delete cascade,
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  step_id integer not null,
  task_id integer not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key (roadmap_id, step_id, task_id, user_id)
);

-- Room chat (human + AI messages)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  username text not null,
  content text not null,
  is_ai boolean not null default false,
  created_at timestamptz not null default now()
);

-- Debug helper: returns the current auth.uid()
create or replace function public.whoami()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.roadmaps enable row level security;
alter table public.progress enable row level security;
alter table public.tasks enable row level security;
alter table public.task_progress enable row level security;
alter table public.messages enable row level security;

-- A user is a member of a room
create or replace function public.is_room_member(room_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = $1 and rm.user_id = auth.uid()
  );
$$;

-- profiles: users read all usernames, edit their own row
create policy "profiles are readable by authenticated users"
  on public.profiles for select to authenticated
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

-- rooms: members can read, authenticated users can create, host can update
create policy "rooms are readable by their members"
  on public.rooms for select to authenticated
  using (public.is_room_member(id));

create policy "authenticated users can create rooms"
  on public.rooms for insert to authenticated
  with check (auth.uid() = created_by);

create policy "host can update the room"
  on public.rooms for update to authenticated
  using (auth.uid() = created_by);

-- room_members: members can list, authenticated users can join, users can leave
create policy "members can view room membership"
  on public.room_members for select to authenticated
  using (public.is_room_member(room_id));

create policy "authenticated users can join rooms"
  on public.room_members for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users can leave rooms"
  on public.room_members for delete to authenticated
  using (auth.uid() = user_id);

-- roadmaps: members can read/create/delete within their rooms
create policy "roadmaps are readable by room members"
  on public.roadmaps for select to authenticated
  using (public.is_room_member(room_id));

create policy "room members can create roadmaps"
  on public.roadmaps for insert to authenticated
  with check (public.is_room_member(room_id));

create policy "room members can delete roadmaps"
  on public.roadmaps for delete to authenticated
  using (public.is_room_member(room_id));

-- progress: members can read/upsert their own rows
create policy "progress is readable by room members"
  on public.progress for select to authenticated
  using (public.is_room_member(room_id));

create policy "members can update their own progress"
  on public.progress for insert to authenticated
  with check (public.is_room_member(room_id) and auth.uid() = user_id);

create policy "members can update their own progress rows"
  on public.progress for update to authenticated
  using (auth.uid() = user_id);

-- tasks: members can read/upsert within their rooms
create policy "tasks are readable by room members"
  on public.tasks for select to authenticated
  using (public.is_room_member(room_id));

create policy "room members can create tasks"
  on public.tasks for insert to authenticated
  with check (public.is_room_member(room_id));

create policy "room members can update tasks"
  on public.tasks for update to authenticated
  using (public.is_room_member(room_id));

create policy "room members can delete tasks"
  on public.tasks for delete to authenticated
  using (public.is_room_member(room_id));

-- task_progress: members can read/upsert their own rows
create policy "task progress is readable by room members"
  on public.task_progress for select to authenticated
  using (public.is_room_member(room_id));

create policy "members can create their own task progress"
  on public.task_progress for insert to authenticated
  with check (public.is_room_member(room_id) and auth.uid() = user_id);

create policy "members can update their own task progress"
  on public.task_progress for update to authenticated
  using (auth.uid() = user_id);

-- messages: members can read/post, anyone can delete (rare) within their rooms
create policy "messages are readable by room members"
  on public.messages for select to authenticated
  using (public.is_room_member(room_id));

create policy "room members can post messages"
  on public.messages for insert to authenticated
  with check (public.is_room_member(room_id));

-- ============================================================
-- REALTIME
-- ============================================================

-- Broadcast changes on the tables the room UI subscribes to
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.progress;
alter publication supabase_realtime add table public.task_progress;
