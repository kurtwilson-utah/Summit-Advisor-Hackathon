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

create index if not exists idx_advisor_threads_access_email_updated_at
on public.advisor_threads (access_email, updated_at desc);

create index if not exists idx_advisor_messages_thread_id_created_at
on public.advisor_messages (thread_id, created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists touch_advisor_threads_updated_at on public.advisor_threads;
create trigger touch_advisor_threads_updated_at
before update on public.advisor_threads
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_advisor_thread_exports_updated_at on public.advisor_thread_exports;
create trigger touch_advisor_thread_exports_updated_at
before update on public.advisor_thread_exports
for each row execute procedure public.touch_updated_at();

revoke all on public.advisor_threads from anon, authenticated;
revoke all on public.advisor_messages from anon, authenticated;
revoke all on public.advisor_thread_exports from anon, authenticated;
