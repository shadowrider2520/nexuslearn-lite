-- NexusLearn Lite production hardening
-- Apply after 0001_init.sql. This migration repairs the invite-code flow,
-- completes documents, and adds safe limits for a public deployment.

alter table public.rooms
  add column if not exists max_members integer not null default 12
  check (max_members between 2 and 100);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_path text not null unique,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  file_type text,
  created_at timestamptz not null default now()
);

create index if not exists documents_room_created_at_idx
  on public.documents (room_id, created_at desc);

alter table public.documents enable row level security;

-- Do not query room_members directly from an RLS policy on that table.
-- These helpers run as definer to avoid recursive policy evaluation.
create or replace function public.is_room_member_storage_path(file_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id::text = split_part(file_path, '/', 1)
      and rm.user_id = auth.uid()
  );
$$;

create or replace function public.join_room_by_invite_code(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_room public.rooms%rowtype;
begin
  select * into selected_room
  from public.rooms
  where invite_code = upper(trim(invite_code_input))
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if exists (
    select 1 from public.room_members
    where room_id = selected_room.id and user_id = auth.uid()
  ) then
    return selected_room.id;
  end if;

  if (select count(*) from public.room_members where room_id = selected_room.id) >= selected_room.max_members then
    raise exception 'This room is full';
  end if;

  insert into public.room_members (room_id, user_id)
  values (selected_room.id, auth.uid());

  return selected_room.id;
end;
$$;

create or replace function public.can_request_ai_reply(room_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_room_member(room_id_input)
    and (
      select count(*)
      from public.messages
      where room_id = room_id_input
        and user_id = auth.uid()
        and created_at > now() - interval '1 minute'
    ) < 6;
$$;

drop policy if exists "documents are readable by room members" on public.documents;
create policy "documents are readable by room members"
  on public.documents for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "room members can upload documents" on public.documents;
create policy "room members can upload documents"
  on public.documents for insert to authenticated
  with check (
    public.is_room_member(room_id)
    and uploaded_by = auth.uid()
    and file_size > 0
    and file_size <= 10485760
  );

drop policy if exists "uploaders can delete their documents" on public.documents;
create policy "uploaders can delete their documents"
  on public.documents for delete to authenticated
  using (uploaded_by = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-documents',
  'room-documents',
  false,
  10485760,
  array[
    'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "room members can read room documents" on storage.objects;
create policy "room members can read room documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'room-documents'
    and public.is_room_member_storage_path(name)
  );

drop policy if exists "room members can upload room documents" on storage.objects;
create policy "room members can upload room documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'room-documents'
    and public.is_room_member_storage_path(name)
  );

drop policy if exists "uploaders can delete room documents" on storage.objects;
create policy "uploaders can delete room documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'room-documents'
    and owner_id = auth.uid()::text
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;
end;
$$;
