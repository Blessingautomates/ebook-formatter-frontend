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

  -- The edited manuscript, as Markdown, written from the dashboard editor.
  --
  -- This column is a deliberate reversal of the table's original design, which
  -- held settings and measurements only. The editor changed the trade: work
  -- typed into it has to survive a reload, and the Markdown form is the same
  -- text /api/export-book already receives, so it is not a second
  -- representation of the book.
  --
  -- Null for a project saved through the upload flow without the editor being
  -- opened. Nothing on the projects list reads it, so the list query could
  -- omit it, but `select`ing it costs one column and keeps the row shape
  -- honest.
  content text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing installs predate the editor, so the column is added separately.
-- `create table if not exists` above is a no-op on a database that already has
-- the table, and this file is meant to be re-runnable.
alter table public.manuscripts
  add column if not exists content text;

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

-- Subscriptions: the plan an account is on, one row per account.
--
-- Written only by the Paddle webhook (app/api/webhooks/paddle/route.ts), which
-- runs with the service-role key because a notification arrives with no session
-- and therefore no `auth.uid()` for a policy to match. That key bypasses the
-- policies below entirely, which is the point: the account must not be able to
-- write its own plan, or there would be nothing to pay for.
--
-- `user_id` is the primary key rather than a surrogate id, because an account
-- has at most one plan and every read is "mine". A second row for the same
-- account would be a bug with no meaning, and the key makes it impossible.
create table if not exists public.subscriptions (
  user_id uuid primary key
    references auth.users (id) on delete cascade,

  -- 'free' is the absence of a subscription, not a row that has to exist: an
  -- account with no row here is on the free plan, and this default only covers
  -- a row that was inserted before its plan was known.
  plan text not null default 'free' check (plan in ('free', 'pro')),

  -- Paddle's own status verbatim — active, trialing, past_due, paused,
  -- canceled. Which of those count as Pro is decided in lib/paddle/webhook.ts,
  -- not here, so the policy can change without a migration. 'inactive' is not
  -- a Paddle status; it is the placeholder for a row inserted without one.
  status text not null default 'inactive',

  -- Paddle's identifiers. Both are how a notification that arrived without our
  -- custom data is matched back to an account, so they are worth storing even
  -- though nothing displays them.
  --
  -- Unique, because two accounts sharing a subscription id would mean the
  -- lookup below could resolve to either. Nullable unique is safe in Postgres:
  -- it permits many rows with no subscription id, which is what a row written
  -- from a bare transaction looks like.
  paddle_subscription_id text unique,
  paddle_customer_id text,

  -- The price that was bought. Not read by anything yet — it is what makes
  -- "which plan is this?" answerable from the row once there is more than one.
  price_id text,

  -- End of the paid period, and when a cancellation was requested. Set by the
  -- subscription events; a transaction on its own does not carry them.
  current_period_end timestamptz,
  canceled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The webhook's fallback lookup for a notification that named no account.
create index if not exists subscriptions_paddle_customer_idx
  on public.subscriptions (paddle_customer_id);

-- Read own, and nothing else. There is deliberately no insert, update or delete
-- policy: with RLS on and no policy permitting them, those statements match no
-- rows and the client cannot write a plan even though it holds a valid session.
-- Only the service-role key, which is not in the browser, gets past this.
alter table public.subscriptions enable row level security;

drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select using ((select auth.uid()) = user_id);

-- Reuses the function defined for manuscripts above, which is why this block
-- sits at the end of the file rather than beside the table.
drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();
