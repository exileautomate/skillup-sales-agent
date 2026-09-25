-- Phase 5 / Module 31: lock the approved OpenAI embedding contract and make
-- source-derived RAG ingestion idempotent. The table is verified empty before
-- this migration is applied.

alter table public.knowledge_base
  alter column embedding type extensions.vector(1536)
  using embedding::extensions.vector(1536),
  add column source_chunk_id text,
  alter column category drop not null;

alter table public.knowledge_base
  alter column source_chunk_id set not null,
  add constraint knowledge_base_source_chunk_id_key unique (source_chunk_id);
