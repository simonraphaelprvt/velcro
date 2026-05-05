-- =============================================================================
-- VELCRO — Supabase Schema
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =============================================================================

-- Enable pgvector extension
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- vault_chunks — stores chunked + embedded Obsidian notes
-- ---------------------------------------------------------------------------

create table if not exists vault_chunks (
  id           uuid primary key default gen_random_uuid(),
  file_path    text not null,
  chunk_index  integer not null,
  content      text not null,
  embedding    vector(1536),
  last_synced  timestamptz not null default now(),
  -- file_path + chunk_index must be unique for upsert to work correctly
  unique (file_path, chunk_index)
);

-- Index for fast approximate nearest-neighbour search
-- ivfflat is good for up to ~1M rows. Use hnsw for larger vaults.
create index if not exists vault_chunks_embedding_idx
  on vault_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for fast file lookups (used in incremental sync)
create index if not exists vault_chunks_file_path_idx
  on vault_chunks (file_path);

-- ---------------------------------------------------------------------------
-- match_vault_chunks — vector similarity search function
-- Called from /api/chat to find relevant context for a query
-- ---------------------------------------------------------------------------

create or replace function match_vault_chunks(
  query_embedding vector(1536),
  match_count     int default 8,
  match_threshold float default 0.3
)
returns table (
  id          uuid,
  file_path   text,
  content     text,
  similarity  float
)
language sql stable
as $$
  select
    id,
    file_path,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from vault_chunks
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- conversations — log every query + response for context history
-- ---------------------------------------------------------------------------

create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  query      text not null,
  response   text not null,
  sources    jsonb,          -- array of {file_path, similarity} objects
  created_at timestamptz not null default now()
);

-- Index for time-based queries (most recent first)
create index if not exists conversations_created_at_idx
  on conversations (created_at desc);

-- =============================================================================
-- Row Level Security
-- Enable RLS so anon key cannot read/write directly.
-- The app uses service_role for writes, anon key never touches these tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- google_tokens — stores OAuth tokens for Calendar + Gmail (single row)
-- Phase 6: run once after adding Google OAuth
-- ---------------------------------------------------------------------------

create table if not exists google_tokens (
  id         integer primary key default 1,
  access_token  text not null,
  refresh_token text not null,
  expiry_date   bigint not null,
  updated_at    timestamptz not null default now(),
  -- Enforce single row
  check (id = 1)
);

-- ---------------------------------------------------------------------------
-- debriefs — Phase 3: structured post-call notes
-- One row per debriefed call/meeting. Contains decisions, todos, mood,
-- and open threads. Morning brief reads this for unfinished todos.
-- ---------------------------------------------------------------------------

create table if not exists debriefs (
  id              uuid primary key default gen_random_uuid(),
  person          text not null,                 -- person, company, or topic
  summary         text not null,                 -- 1-3 sentence prose
  decisions       jsonb not null default '[]',   -- array of strings
  todos           jsonb not null default '[]',   -- array of {text, done, due?}
  mood            text,                          -- "good" | "neutral" | "tense" | freeform
  open_threads    jsonb not null default '[]',   -- array of strings
  source_event_id text,                          -- optional: linked calendar event
  created_at      timestamptz not null default now()
);

create index if not exists debriefs_created_at_idx
  on debriefs (created_at desc);
create index if not exists debriefs_person_idx
  on debriefs (lower(person));

-- ---------------------------------------------------------------------------
-- spotify_tokens — Phase 4: Spotify OAuth tokens (single row, id=1)
-- ---------------------------------------------------------------------------

create table if not exists spotify_tokens (
  id            integer primary key default 1,
  access_token  text not null,
  refresh_token text not null,
  expiry_date   bigint not null,
  updated_at    timestamptz not null default now(),
  check (id = 1)
);

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table vault_chunks enable row level security;
alter table conversations enable row level security;
alter table google_tokens enable row level security;
alter table debriefs enable row level security;
alter table spotify_tokens enable row level security;

-- No public policies — all access goes through service_role or API routes.
-- This means: nobody can query these tables directly via the anon key.
