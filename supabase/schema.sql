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

-- ===========================================================================
-- Workspaces, collaboration, covers, approvals and credits
-- ===========================================================================
--
-- Everything below is new in the Book Studio build. It is appended rather than
-- interleaved so the sections above keep their own reasoning, and it follows the
-- same rule as the rest of this file: re-runnable, and RLS is the only thing
-- protecting a row.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
--
-- `auth.users` cannot be read by the anon key and is not exposed through
-- PostgREST, so anything that needs to show *who* a member is needs its own
-- table. This is that table: a mirror of the one thing we display, kept in step
-- by the functions below rather than by a trigger on the auth schema.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Workspaces
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),

  -- Defaulted to the caller for the same reason `manuscripts.user_id` is: the
  -- key is never in the request, so a row cannot be filed under another
  -- account even if the client asks.
  owner_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  name text not null default 'Personal',
  kind text not null default 'personal' check (kind in ('personal', 'agency')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- An account has exactly one personal workspace. This partial unique index is
-- what makes `ensure_personal_workspace()` idempotent, and what stops two tabs
-- racing each other into creating two.
create unique index if not exists workspaces_one_personal_per_owner_idx
  on public.workspaces (owner_id) where kind = 'personal';

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The four badges from the brief. Stored rather than derived because which
  -- one a person holds is a decision the owner made, not a fact about them.
  role text not null default 'editor'
    check (role in ('owner', 'editor', 'proofreader', 'approver')),

  created_at timestamptz not null default now(),

  -- A person holds one role per workspace. Two rows would make "what may this
  -- person do" ambiguous, which is the one thing a policy must never be.
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id);

-- Rank, so a policy can ask for "editor or above" without listing roles.
create or replace function public.role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'owner' then 4
    when 'approver' then 3
    when 'editor' then 2
    when 'proofreader' then 1
    else 0
  end;
$$;

-- Is the caller a member of this workspace, at this rank or above?
--
-- `security definer` is load-bearing, not a convenience. A policy on
-- `workspace_members` that queries `workspace_members` to decide what the
-- caller may see recurses: evaluating the policy requires evaluating the
-- policy. Running as the definer skips RLS on the table being read and breaks
-- the cycle. `set search_path` is what keeps a definer function from being
-- redirected at a table someone else controls.
create or replace function public.is_workspace_member(
  p_workspace_id uuid,
  p_min_role text default 'proofreader'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and public.role_rank(m.role) >= public.role_rank(p_min_role)
  );
$$;

-- Do the caller and this user share any workspace?
--
-- Same recursion problem, same answer. Used by the profiles policy so an
-- address is visible to the people collaborating with it and nobody else.
create or replace function public.shares_workspace_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs
      on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
  );
$$;

-- The owner of a new workspace becomes its first member.
--
-- A trigger rather than a second statement in the client: a workspace with no
-- members is invisible to everyone including whoever just created it, so the
-- two writes must not be separable.
create or replace function public.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists workspaces_add_owner on public.workspaces;
create trigger workspaces_add_owner
  after insert on public.workspaces
  for each row execute function public.add_workspace_owner();

-- The caller's personal workspace, created on first call.
--
-- RPC rather than an insert from the client because "create it if it is not
-- there" is only safe with the partial unique index above and an upsert, and
-- because it is also the natural place to keep the caller's profile in step.
create or replace function public.ensure_personal_workspace()
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.workspaces;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  insert into public.workspaces (owner_id, name, kind)
  values (v_uid, 'Personal', 'personal')
  on conflict (owner_id) where kind = 'personal' do nothing;

  select * into v_row
    from public.workspaces
   where owner_id = v_uid and kind = 'personal';

  -- Readable only by the definer, which is why this mirror exists at all.
  insert into public.profiles (user_id, email)
  select u.id, u.email from auth.users u where u.id = v_uid
  on conflict (user_id) do update set email = excluded.email;

  return v_row;
end;
$$;

-- Add someone to a workspace by email address.
--
-- An RPC because resolving an address means reading `auth.users`. The owner
-- check is here rather than left to RLS on `workspace_members`, because a
-- definer function is not subject to the policies it would otherwise rely on.
create or replace function public.invite_workspace_member(
  p_workspace_id uuid,
  p_email text,
  p_role text default 'editor'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.owner_id = auth.uid()
  ) then
    raise exception 'Only the workspace owner can add members';
  end if;

  if p_role not in ('owner', 'editor', 'proofreader', 'approver') then
    raise exception 'Unknown role: %', p_role;
  end if;

  select u.id into v_target
    from auth.users u
   where lower(u.email) = lower(btrim(p_email))
   limit 1;

  -- Reported rather than silently adding nobody: "no account with that
  -- address" is a typo the user can fix, an empty member list is not.
  if v_target is null then
    raise exception 'No account is registered with that address';
  end if;

  insert into public.profiles (user_id, email)
  select u.id, u.email from auth.users u where u.id = v_target
  on conflict (user_id) do update set email = excluded.email;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, v_target, p_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  return v_target;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;

-- A workspace is visible to its members, including members who do not own it.
drop policy if exists "read own workspaces" on public.workspaces;
create policy "read own workspaces" on public.workspaces
  for select using (public.is_workspace_member(id));

drop policy if exists "insert own workspaces" on public.workspaces;
create policy "insert own workspaces" on public.workspaces
  for insert with check ((select auth.uid()) = owner_id);

-- Renaming is the owner's; nobody else's list should change under them.
drop policy if exists "update own workspaces" on public.workspaces;
create policy "update own workspaces" on public.workspaces
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "delete own workspaces" on public.workspaces;
create policy "delete own workspaces" on public.workspaces
  for delete using ((select auth.uid()) = owner_id and kind = 'agency');

-- Members are visible to the workspace they are in, which is what lets a
-- reviewer see who else is on the book.
drop policy if exists "read workspace members" on public.workspace_members;
create policy "read workspace members" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

-- Only the owner changes the roster, and only through their own rows: the
-- `with check` pins the new row to a workspace they own.
drop policy if exists "manage workspace members" on public.workspace_members;
create policy "manage workspace members" on public.workspace_members
  for insert with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );

drop policy if exists "update workspace members" on public.workspace_members;
create policy "update workspace members" on public.workspace_members
  for update using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );

drop policy if exists "remove workspace members" on public.workspace_members;
create policy "remove workspace members" on public.workspace_members
  for delete using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );

-- Your own address, or one belonging to someone you collaborate with. Not
-- every address on the instance, which is what a bare `using (true)` would be.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (
    user_id = (select auth.uid())
    or public.shares_workspace_with(user_id)
  );

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Books gain a workspace, a page count and a language
-- ---------------------------------------------------------------------------

alter table public.manuscripts
  add column if not exists workspace_id uuid
    references public.workspaces (id) on delete set null;

-- Populated from the analyzer's estimate. Stored because the cover check needs
-- a page count to compute spine width, and a cover can be validated without the
-- manuscript being re-uploaded.
alter table public.manuscripts
  add column if not exists page_count integer not null default 0;

-- The language the analyzer detected. Stored because re-detecting it means
-- re-uploading the manuscript, and the grid badges it.
alter table public.manuscripts
  add column if not exists language text;

create index if not exists manuscripts_workspace_idx
  on public.manuscripts (workspace_id, updated_at desc);

-- A book's owner cannot be reassigned by an update.
--
-- Without this, a workspace editor — who may update a book they do not own —
-- could set `user_id` to themselves and take it. Pinning it in a trigger keeps
-- the `update` policy's `with check` simple, because there is then no way for
-- the column to change and nothing for the check to guard.
create or replace function public.pin_manuscript_owner()
returns trigger
language plpgsql
as $$
begin
  new.user_id = old.user_id;
  return new;
end;
$$;

drop trigger if exists manuscripts_pin_owner on public.manuscripts;
create trigger manuscripts_pin_owner
  before update on public.manuscripts
  for each row execute function public.pin_manuscript_owner();

-- Books are readable by the workspace they are filed in. A book with no
-- workspace is still the owner's alone, which is what the policies above say.
drop policy if exists "read workspace manuscripts" on public.manuscripts;
create policy "read workspace manuscripts" on public.manuscripts
  for select using (
    workspace_id is not null and public.is_workspace_member(workspace_id)
  );

-- Editors and above may revise a manuscript in their workspace; proofreaders
-- annotate it through comments instead, which is the separation the brief asks
-- for. The insert policy is replaced rather than added to, because permissive
-- policies are OR'd and a second one that skipped the owner check would let an
-- insert name someone else's account.
drop policy if exists "insert own manuscripts" on public.manuscripts;
create policy "insert own manuscripts" on public.manuscripts
  for insert with check (
    (select auth.uid()) = user_id
    and (workspace_id is null or public.is_workspace_member(workspace_id))
  );

drop policy if exists "update own manuscripts" on public.manuscripts;
create policy "update own manuscripts" on public.manuscripts
  for update using (
    (select auth.uid()) = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id, 'editor'))
  )
  with check (
    (select auth.uid()) = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id, 'editor'))
  );

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
--
-- Threaded by `parent_id` rather than by a second table: a reply is a comment
-- with a parent, and a reply to a reply is the same thing one level deeper.
-- Nesting is flattened in the UI, so the depth is not bounded here.
create table if not exists public.book_comments (
  id uuid primary key default gen_random_uuid(),

  manuscript_id uuid not null
    references public.manuscripts (id) on delete cascade,

  parent_id uuid references public.book_comments (id) on delete cascade,

  author_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  -- Which chapter the note is about. A title rather than a line number, because
  -- a comment on "Chapter 3" has to survive the chapter being edited above it.
  chapter_title text,

  body text not null check (length(btrim(body)) > 0),

  status text not null default 'open'
    check (status in ('open', 'resolved', 'approved')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_comments_manuscript_idx
  on public.book_comments (manuscript_id, created_at);

-- May the caller see this manuscript at all? The same rule the manuscripts
-- policies express, in one place the comment policies can reuse.
create or replace function public.can_read_manuscript(p_manuscript_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.manuscripts m
    where m.id = p_manuscript_id
      and (
        m.user_id = auth.uid()
        or (m.workspace_id is not null and public.is_workspace_member(m.workspace_id))
      )
  );
$$;

alter table public.book_comments enable row level security;

drop policy if exists "read comments on visible books" on public.book_comments;
create policy "read comments on visible books" on public.book_comments
  for select using (public.can_read_manuscript(manuscript_id));

-- Anyone who can see the book may comment on it, and only as themselves.
drop policy if exists "write own comments" on public.book_comments;
create policy "write own comments" on public.book_comments
  for insert with check (
    (select auth.uid()) = author_id
    and public.can_read_manuscript(manuscript_id)
  );

-- Resolving someone else's note is the point of a review, so the update is not
-- restricted to the author. The book's owner can always moderate.
drop policy if exists "resolve comments on visible books" on public.book_comments;
create policy "resolve comments on visible books" on public.book_comments
  for update using (
    (select auth.uid()) = author_id
    or public.can_read_manuscript(manuscript_id)
  )
  with check (
    (select auth.uid()) = author_id
    or public.can_read_manuscript(manuscript_id)
  );

drop policy if exists "delete own comments" on public.book_comments;
create policy "delete own comments" on public.book_comments
  for delete using ((select auth.uid()) = author_id);

-- ---------------------------------------------------------------------------
-- Cover assets
-- ---------------------------------------------------------------------------
--
-- The file lives in Storage; this row holds the measurements taken from it, so
-- a validated cover does not have to be re-measured on every page load.
create table if not exists public.cover_assets (
  id uuid primary key default gen_random_uuid(),

  manuscript_id uuid not null
    references public.manuscripts (id) on delete cascade,

  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  storage_path text,
  width_px integer check (width_px is null or width_px > 0),
  height_px integer check (height_px is null or height_px > 0),
  dpi integer check (dpi is null or dpi > 0),

  -- pass | warn | fail, matching the three states the drawer renders.
  status text not null default 'pending'
    check (status in ('pending', 'passed', 'warnings', 'failed')),

  -- [{"id": "dpi", "status": "warn", "measured": 72, "required": 300, …}, …]
  checks jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists cover_assets_manuscript_idx
  on public.cover_assets (manuscript_id, created_at desc);

alter table public.cover_assets enable row level security;

drop policy if exists "read covers on visible books" on public.cover_assets;
create policy "read covers on visible books" on public.cover_assets
  for select using (public.can_read_manuscript(manuscript_id));

drop policy if exists "write own covers" on public.cover_assets;
create policy "write own covers" on public.cover_assets
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_read_manuscript(manuscript_id)
  );

drop policy if exists "delete own covers" on public.cover_assets;
create policy "delete own covers" on public.cover_assets
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Approvals
-- ---------------------------------------------------------------------------
--
-- One signature per person per book. The three flags mirror the three
-- checkboxes in the sign-off modal — they are stored individually because "I
-- reviewed the manuscript" and "I approve the export" are different statements,
-- and an approval that recorded only "signed" could not tell them apart.
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),

  manuscript_id uuid not null
    references public.manuscripts (id) on delete cascade,

  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  reviewed_manuscript boolean not null default false,
  approved_formatting boolean not null default false,
  approved_export boolean not null default false,

  signed_at timestamptz,
  created_at timestamptz not null default now(),

  -- Signing twice is a correction, not a second signature.
  unique (manuscript_id, user_id)
);

alter table public.approvals enable row level security;

drop policy if exists "read approvals on visible books" on public.approvals;
create policy "read approvals on visible books" on public.approvals
  for select using (public.can_read_manuscript(manuscript_id));

drop policy if exists "sign own approvals" on public.approvals;
create policy "sign own approvals" on public.approvals
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_read_manuscript(manuscript_id)
  );

drop policy if exists "update own approvals" on public.approvals;
create policy "update own approvals" on public.approvals
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- AI credits
-- ---------------------------------------------------------------------------
--
-- A ledger, not a counter. Every grant and every spend is a row, and the
-- balance is their sum — a counter would need a read-modify-write on each
-- spend, which two concurrent analyses would race. Appending cannot race.
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  -- Signed: positive is a grant, negative a spend.
  delta integer not null,

  reason text not null,
  -- What it was spent on — a manuscript id, a period, an analysis id. Not
  -- interpreted by the database; it is what makes a ledger entry explainable.
  ref text,

  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);

-- One row per account per month, and the reason `ensure_credit_grant()` can be
-- called on every page load without granting twice.
create table if not exists public.credit_grants (
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  period_start date not null,
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

alter table public.credit_ledger enable row level security;
alter table public.credit_grants enable row level security;

-- Read own, and nothing else. There is deliberately no insert, update or delete
-- policy on `credit_ledger`: an account that could write its own balance would
-- have no reason to buy credits. Rows are written by the two definer functions
-- below, or by the backend with the service-role key.
drop policy if exists "read own credits" on public.credit_ledger;
create policy "read own credits" on public.credit_ledger
  for select using ((select auth.uid()) = user_id);

drop policy if exists "read own credit grants" on public.credit_grants;
create policy "read own credit grants" on public.credit_grants
  for select using ((select auth.uid()) = user_id);

-- Issue this month's allowance, once.
--
-- Idempotent through the primary key on `credit_grants`: the insert either
-- happens, in which case the ledger entry is written, or it conflicts and
-- nothing is granted. `found` is what distinguishes those two — it is set by
-- the insert itself, so a month that was already granted writes no ledger row.
create or replace function public.ensure_credit_grant()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_period date := date_trunc('month', now())::date;
  v_plan text;
  v_amount integer;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select s.plan into v_plan
    from public.subscriptions s
   where s.user_id = v_uid;

  -- The allowance lives here rather than in a table because it is a property of
  -- the plan, and the plan is already the thing that decides it. Kept in step
  -- with lib/credits.ts, which is the copy the UI shows.
  v_amount := case when v_plan = 'pro' then 100000 else 25000 end;

  insert into public.credit_grants (user_id, period_start, amount)
  values (v_uid, v_period, v_amount)
  on conflict (user_id, period_start) do nothing;

  if found then
    insert into public.credit_ledger (user_id, delta, reason, ref)
    values (v_uid, v_amount, 'monthly_grant', v_period::text);
  end if;
end;
$$;

-- The balance, this period's spend, and when the period started.
--
-- Summed in the database rather than by fetching rows and adding them up in the
-- browser: a ledger only grows, so a client-side sum would be correct on day
-- one and silently wrong once the read hits its row limit.
create or replace function public.credit_summary()
returns table (balance bigint, spent bigint, period_start date)
language sql
stable
security definer
set search_path = public
as $$
  with period as (
    select date_trunc('month', now())::date as starts
  )
  select
    -- The balance is the sum of the whole ledger, not of this period. Scoping
    -- it to the period would reset every account to its allowance on the first
    -- of the month, discarding whatever it had saved up.
    coalesce((
      select sum(l.delta)
        from public.credit_ledger l
       where l.user_id = auth.uid()
    ), 0)::bigint as balance,

    -- Spend is the period's, because it is only ever shown against the
    -- allowance that period granted.
    coalesce((
      select sum(-l.delta)
        from public.credit_ledger l, period p
       where l.user_id = auth.uid()
         and l.delta < 0
         and l.created_at >= p.starts
    ), 0)::bigint as spent,

    (select starts from period) as period_start;
$$;

-- Spend credits, atomically, and refuse to overdraw.
--
-- This is the only way a debit can be written. It is a `security definer`
-- function whose execute privilege is revoked from `anon` and `authenticated`
-- and granted only to `service_role`, so the backend can call it and a browser
-- cannot — which is the point, because a client that could call it could spend
-- credits it does not have, or credit itself.
--
-- The balance check and the insert are one statement each inside one
-- transaction, under a per-account advisory lock. Without the lock, two
-- analyses starting together would both read the same balance, both decide it
-- was sufficient, and both insert: the account would end up overdrawn by
-- exactly the amount concurrency hid from it.
create or replace function public.debit_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_ref text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null then
    raise exception 'A debit needs an account.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'A debit must be a positive number of credits.';
  end if;

  -- Released when the transaction ends, so a failed debit does not leave the
  -- account locked.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(l.delta), 0)::integer into v_balance
    from public.credit_ledger l
   where l.user_id = p_user_id;

  if v_balance < p_amount then
    -- The literal is parsed by services/credits.py, which turns it into a 402
    -- with the numbers in it. Raising beats returning a null the caller might
    -- forget to check.
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (p_user_id, -p_amount, p_reason, p_ref);

  return v_balance - p_amount;
end;
$$;

-- Only the backend may spend. `public` is revoked too: in Postgres every role
-- inherits from it, so revoking from `anon` alone would leave the default
-- grant in place.
revoke all on function public.debit_credits(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.debit_credits(uuid, integer, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- updated_at triggers for the new tables
-- ---------------------------------------------------------------------------
--
-- `touch_updated_at` is defined beside the manuscripts table above; these are
-- the new tables that carry the column.
drop trigger if exists workspaces_touch_updated_at on public.workspaces;
create trigger workspaces_touch_updated_at
  before update on public.workspaces
  for each row execute function public.touch_updated_at();

drop trigger if exists book_comments_touch_updated_at on public.book_comments;
create trigger book_comments_touch_updated_at
  before update on public.book_comments
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Storage: the covers bucket
-- ---------------------------------------------------------------------------
--
-- Private, and scoped to the uploader's own folder. A public bucket would make
-- every author's cover readable by anyone who guessed a path, and covers are
-- unpublished artwork.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', false)
on conflict (id) do nothing;

drop policy if exists "read own covers in storage" on storage.objects;
create policy "read own covers in storage" on storage.objects
  for select using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "upload own covers" on storage.objects;
create policy "upload own covers" on storage.objects
  for insert with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "delete own covers from storage" on storage.objects;
create policy "delete own covers from storage" on storage.objects
  for delete using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Manuscript health scans ("Book Doctor")
-- ---------------------------------------------------------------------------
--
-- One row per scan. The headline numbers get columns of their own because the
-- dashboard filters and sorts on them; the report body goes to jsonb for the
-- reason given for manuscripts.chapters above — it is read and written whole,
-- never queried into.
--
-- Rows are written by the backend with the service role, because a scan runs as
-- a background task after the request that asked for it has already been
-- answered and its token discarded. That is why there is a select policy here
-- and nothing else: an author may read their own scans, and cannot forge,
-- edit, or delete one. A scan is a record of what the server found.
create table if not exists public.manuscript_health (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  manuscript_id uuid references public.manuscripts (id) on delete cascade,
  source_filename text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'stale')),
  -- Free text rather than an enum: stages are a progress detail and will be
  -- added to, and a check constraint here would mean a migration per stage.
  stage text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  error text,
  metrics jsonb,
  categories jsonb,
  health_score integer check (health_score between 0 and 100),
  total_findings integer,
  fixable_findings integer,
  -- Whether the AI pass ran, and what it cost. Kept apart from the synthetic
  -- token_cost the analyze endpoint reports: that one is a price estimate, this
  -- one is money actually spent.
  ai_available boolean not null default false,
  ai_note text,
  ai_model text,
  ai_calls integer not null default 0,
  ai_cost_usd numeric(10, 6) not null default 0,
  ai_credits integer not null default 0,
  scanned_at timestamptz,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manuscript_health_user_recent_idx
  on public.manuscript_health (user_id, created_at desc);

-- The dashboard shows a manuscript's most recent scan, so this is the index
-- that serves it.
create index if not exists manuscript_health_manuscript_recent_idx
  on public.manuscript_health (manuscript_id, created_at desc);

alter table public.manuscript_health enable row level security;

drop policy if exists "read own health scans" on public.manuscript_health;
create policy "read own health scans" on public.manuscript_health
  for select using ((select auth.uid()) = user_id);

drop trigger if exists manuscript_health_touch_updated_at on public.manuscript_health;
create trigger manuscript_health_touch_updated_at
  before update on public.manuscript_health
  for each row execute function public.touch_updated_at();
