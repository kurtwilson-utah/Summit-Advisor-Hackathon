create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

revoke all on public.allowed_users from anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  allowed_user_id uuid references public.allowed_users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allow_row public.allowed_users;
begin
  select *
    into allow_row
  from public.allowed_users
  where lower(email) = lower(new.email)
    and is_active = true
  limit 1;

  if allow_row.id is null then
    raise exception 'Email is not allowlisted';
  end if;

  insert into public.profiles (id, email, full_name, allowed_user_id)
  values (new.id, new.email, allow_row.full_name, allow_row.id)
  on conflict (id) do update
    set email = excluded.email,
        full_name = allow_row.full_name,
        allowed_user_id = allow_row.id,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_auth_user();

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'New conversation',
  external_assistant_name text not null default 'Cyncly Advisor',
  active_agent text not null default 'summit-product-manager',
  lifecycle_state text not null default 'active',
  summary text,
  memory_digest text,
  last_message_at timestamptz not null default timezone('utc', now()),
  conversation_closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  agent_key text,
  body_display text not null,
  body_redacted text not null,
  redaction_map jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.thread_memory_snapshots (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  snapshot_index integer not null,
  summary_markdown text not null,
  source_message_count integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (thread_id, snapshot_index)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  parent_message_id uuid references public.chat_messages (id) on delete set null,
  agent_key text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table if not exists public.conversation_exports (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  export_kind text not null check (export_kind in ('transcript', 'idea-capture')),
  status text not null check (status in ('pending', 'sent', 'failed')),
  notion_page_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz
);

create table if not exists public.file_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  original_name text not null,
  kind text not null check (kind in ('chat-attachment', 'rag-source', 'rag-derived')),
  size_bytes bigint not null default 0,
  checksum text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  file_asset_id uuid not null unique references public.file_assets (id) on delete cascade,
  title text not null,
  source_type text not null,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'processing', 'ready', 'failed')),
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rag_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_estimate integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default timezone('utc', now()),
  unique (document_id, chunk_index)
);

create table if not exists public.advisor_threads (
  id uuid primary key,
  access_email text not null,
  access_name text not null,
  title text not null default 'New conversation',
  status_label text not null default 'Draft',
  summary text not null default '',
  memory_digest text not null default '',
  notion_status text not null default 'Not exported',
  agent_states jsonb not null default '[]'::jsonb,
  last_message_at timestamptz not null default timezone('utc', now()),
  conversation_closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.advisor_messages (
  id uuid primary key,
  thread_id uuid not null references public.advisor_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  author_label text not null,
  body_display text not null,
  body_model text,
  agent_key text,
  attachments jsonb not null default '[]'::jsonb,
  redaction jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.advisor_thread_exports (
  thread_id uuid primary key references public.advisor_threads (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  close_reason text,
  transcript_page_id text,
  idea_page_ids jsonb not null default '[]'::jsonb,
  idea_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_chat_threads_owner_id on public.chat_threads (owner_id);
create index if not exists idx_chat_messages_thread_id_created_at on public.chat_messages (thread_id, created_at);
create index if not exists idx_thread_memory_snapshots_thread_id on public.thread_memory_snapshots (thread_id);
create index if not exists idx_agent_runs_thread_id on public.agent_runs (thread_id);
create index if not exists idx_conversation_exports_thread_id on public.conversation_exports (thread_id);
create index if not exists idx_file_assets_owner_id on public.file_assets (owner_id);
create index if not exists idx_rag_documents_file_asset_id on public.rag_documents (file_asset_id);
create index if not exists idx_rag_chunks_document_id on public.rag_chunks (document_id);
create index if not exists idx_advisor_threads_access_email_updated_at on public.advisor_threads (access_email, updated_at desc);
create index if not exists idx_advisor_messages_thread_id_created_at on public.advisor_messages (thread_id, created_at);

create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute procedure public.touch_updated_at();

create trigger touch_chat_threads_updated_at
before update on public.chat_threads
for each row execute procedure public.touch_updated_at();

create trigger touch_rag_documents_updated_at
before update on public.rag_documents
for each row execute procedure public.touch_updated_at();

create trigger touch_advisor_threads_updated_at
before update on public.advisor_threads
for each row execute procedure public.touch_updated_at();

create trigger touch_advisor_thread_exports_updated_at
before update on public.advisor_thread_exports
for each row execute procedure public.touch_updated_at();

create or replace function public.bump_thread_after_message()
returns trigger
language plpgsql
as $$
begin
  update public.chat_threads
     set last_message_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where id = new.thread_id;

  return new;
end;
$$;

drop trigger if exists on_chat_message_insert on public.chat_messages;

create trigger on_chat_message_insert
after insert on public.chat_messages
for each row execute procedure public.bump_thread_after_message();

alter table public.profiles enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.thread_memory_snapshots enable row level security;
alter table public.agent_runs enable row level security;
alter table public.conversation_exports enable row level security;
alter table public.file_assets enable row level security;
alter table public.rag_documents enable row level security;
alter table public.rag_chunks enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id);

create policy "chat_threads_select_own"
on public.chat_threads
for select
using (owner_id = auth.uid());

create policy "chat_threads_insert_own"
on public.chat_threads
for insert
with check (owner_id = auth.uid());

create policy "chat_threads_update_own"
on public.chat_threads
for update
using (owner_id = auth.uid());

create policy "chat_messages_select_own"
on public.chat_messages
for select
using (
  exists (
    select 1
    from public.chat_threads
    where public.chat_threads.id = chat_messages.thread_id
      and public.chat_threads.owner_id = auth.uid()
  )
);

create policy "chat_messages_insert_own"
on public.chat_messages
for insert
with check (
  exists (
    select 1
    from public.chat_threads
    where public.chat_threads.id = chat_messages.thread_id
      and public.chat_threads.owner_id = auth.uid()
  )
);

create policy "thread_memory_snapshots_select_own"
on public.thread_memory_snapshots
for select
using (
  exists (
    select 1
    from public.chat_threads
    where public.chat_threads.id = thread_memory_snapshots.thread_id
      and public.chat_threads.owner_id = auth.uid()
  )
);

create policy "thread_memory_snapshots_insert_own"
on public.thread_memory_snapshots
for insert
with check (
  exists (
    select 1
    from public.chat_threads
    where public.chat_threads.id = thread_memory_snapshots.thread_id
      and public.chat_threads.owner_id = auth.uid()
  )
);

create policy "agent_runs_select_own"
on public.agent_runs
for select
using (
  exists (
    select 1
    from public.chat_threads
    where public.chat_threads.id = agent_runs.thread_id
      and public.chat_threads.owner_id = auth.uid()
  )
);

create policy "agent_runs_insert_own"
on public.agent_runs
for insert
with check (
  exists (
    select 1
    from public.chat_threads
    where public.chat_threads.id = agent_runs.thread_id
      and public.chat_threads.owner_id = auth.uid()
  )
);

create policy "conversation_exports_select_own"
on public.conversation_exports
for select
using (
  exists (
    select 1
    from public.chat_threads
    where public.chat_threads.id = conversation_exports.thread_id
      and public.chat_threads.owner_id = auth.uid()
  )
);

create policy "conversation_exports_insert_own"
on public.conversation_exports
for insert
with check (
  exists (
    select 1
    from public.chat_threads
    where public.chat_threads.id = conversation_exports.thread_id
      and public.chat_threads.owner_id = auth.uid()
  )
);

create policy "file_assets_select_own"
on public.file_assets
for select
using (owner_id = auth.uid());

create policy "file_assets_insert_own"
on public.file_assets
for insert
with check (owner_id = auth.uid());

revoke all on public.rag_documents from anon, authenticated;
revoke all on public.rag_chunks from anon, authenticated;
revoke all on public.advisor_threads from anon, authenticated;
revoke all on public.advisor_messages from anon, authenticated;
revoke all on public.advisor_thread_exports from anon, authenticated;

insert into public.allowed_users (email, full_name, role)
values
  ('kurt.wilson@cyncly.com', 'Kurt Wilson', 'member'),
  ('grant.noe@cyncly.com', 'Grant Noe', 'member')
on conflict (email) do nothing;
