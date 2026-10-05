create extension if not exists vector;
create extension if not exists pgcrypto;

-- ===== Tenancy =====
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  primary key (workspace_id, user_id)
);

-- Helper used by every RLS policy
create or replace function is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members
                 where workspace_id = ws and user_id = auth.uid());
$$;

-- Create workspace + membership atomically (avoids RLS chicken-and-egg)
create or replace function create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into workspaces(name, created_by) values (p_name, auth.uid()) returning id into ws;
  insert into workspace_members(workspace_id, user_id) values (ws, auth.uid());
  return ws;
end $$;

-- ===== Documents + THE shared vector store =====
create table documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  filename text not null,
  content_hash text not null,               -- sha256 of file bytes
  status text not null default 'processing', -- processing | ready | failed
  error text,
  chunk_count int not null default 0,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, content_hash)       -- IDEMPOTENCY: same file twice = same row
);

create table document_chunks (               -- ONE table for ALL workspaces
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  page_number int,
  content text not null,
  embedding vector(768) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)          -- IDEMPOTENCY at chunk level
);
create index on document_chunks (workspace_id);

-- ===== Chat, tasks, tool log =====
create table messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('user','assistant')),
  content text not null,
  status text not null default 'done',       -- pending | done | error
  sources jsonb not null default '[]',       -- citations
  debug jsonb,                               -- retrieved chunks, scores, tokens, latency
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table tool_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  tool_name text not null,
  arguments jsonb,
  status text not null,                      -- success | error | rejected
  result jsonb,
  error text,
  duration_ms int,
  created_at timestamptz not null default now()
);

-- ===== RLS: every table, membership-based =====
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
alter table documents         enable row level security;
alter table document_chunks   enable row level security;
alter table messages          enable row level security;
alter table tasks             enable row level security;
alter table tool_calls        enable row level security;

create policy ws_select on workspaces for select using (is_member(id));
create policy wm_select on workspace_members for select using (user_id = auth.uid());

create policy doc_all   on documents       for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy chunk_all on document_chunks for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy msg_all   on messages        for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy task_all  on tasks           for all using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy tc_all    on tool_calls      for all using (is_member(workspace_id)) with check (is_member(workspace_id));

-- ===== THE isolation-critical query =====
-- Workspace filter is INSIDE the vector search. security invoker → RLS applies too.
create or replace function match_chunks(
  p_workspace_id uuid,
  p_query_embedding vector(768),
  p_match_count int default 6
)
returns table (id uuid, document_id uuid, filename text, page_number int,
               chunk_index int, content text, similarity float)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.document_id, d.filename, c.page_number, c.chunk_index, c.content,
         1 - (c.embedding <=> p_query_embedding) as similarity
  from document_chunks c
  join documents d on d.id = c.document_id
  where c.workspace_id = p_workspace_id
    and d.status = 'ready'
  order by c.embedding <=> p_query_embedding
  limit least(p_match_count, 20);
$$;
