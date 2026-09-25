-- Manuscripts: one saved project per row.
--
-- Run this against the project named by NEXT_PUBLIC_SUPABASE_URL — paste it
-- into the Supabase SQL editor, or `supabase db execute --file supabase/schema.sql`.
-- It is written to be re-runnable.

-- gen_random_uuid() is built into Postgres 13 and later; pgcrypto provides it
-- on anything older, which some Supabase instances still are.
create extension if not exists pgcrypto;

create table if not exists public.manuscripts (
  id uuid primary key default gen_random_uuid(),

  -- Defaulted to the caller rather than sent by the client. An insert cannot
  -- file a row under someone else's account even if it asks to: the insert
  -- policy below rejects the mismatch, and the key is never in the request.
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  title text not null default 'Untitled',
  -- Part of the exported title page, so it is stored with the rest of the
  -- export's settings rather than re-typed on every visit.
  author text,

  word_count integer not null default 0 check (word_count >= 0),
  chapter_count integer not null default 0 check (chapter_count >= 0),

  -- [{"title": "Chapter 1", "line_number": 18, "word_count": 3120}, …]
  --
  -- jsonb rather than a child table: the breakdown is only ever read and
  -- written together with its manuscript, is never joined or aggregated across
  -- books, and its shape belongs to the analyzer. A table would add a second
  -- round trip and a foreign key for no query it would ever serve.
  chapters jsonb not null default '[]'::jsonb,

  genre text not null default 'fiction',
  font_family text,
  font_size numeric,
  trim_size text not null default '6x9',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The projects list is always "mine, newest first".
create index if not exists manuscripts_user_recent_idx
  on public.manuscripts (user_id, updated_at desc);

-- Row-level security is the *only* thing protecting these rows. The anon key is
-- published to every browser that loads the site, so anyone can query this
-- table; the policies are what decide which rows come back. Leaving RLS off —
-- or writing a policy that does not check the owner — would expose every user's
-- manuscripts to every other user.
alter table public.manuscripts enable row level security;

-- `(select auth.uid())` rather than a bare `auth.uid()`: wrapping it lets the
-- planner evaluate it once per query instead of once per row, which matters on
-- a table that grows with every save.
drop policy if exists "read own manuscripts" on public.manuscripts;
create policy "read own manuscripts" on public.manuscripts
  for select using ((select auth.uid()) = user_id);

drop policy if exists "insert own manuscripts" on public.manuscripts;
create policy "insert own manuscripts" on public.manuscripts
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "update own manuscripts" on public.manuscripts;
create policy "update own manuscripts" on public.manuscripts
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "delete own manuscripts" on public.manuscripts;
create policy "delete own manuscripts" on public.manuscripts
  for delete using ((select auth.uid()) = user_id);

-- updated_at is maintained here, not by the client, so it cannot be set to
-- whatever the caller likes and orders correctly in the projects list.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists manuscripts_touch_updated_at on public.manuscripts;
create trigger manuscripts_touch_updated_at
  before update on public.manuscripts
  for each row execute function public.touch_updated_at();
