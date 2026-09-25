-- Phase 5 / Module 32: read-only exact cosine retrieval over the M31 corpus.
-- No ANN index is needed for the current 96-vector corpus.

create or replace function public.match_skillup_rag_chunks(
  query_embedding extensions.vector(1536),
  requested_course_id uuid,
  max_cosine_distance double precision,
  max_results integer
)
returns table (
  id uuid,
  source_chunk_id text,
  course_id uuid,
  title text,
  content text,
  category text,
  intent text,
  knowledge_class public.knowledge_class,
  student_facing boolean,
  metadata_json jsonb,
  source_document text,
  source_section text,
  distance double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    kb.id,
    kb.source_chunk_id,
    kb.course_id,
    kb.title,
    kb.content,
    kb.category,
    kb.intent,
    kb.knowledge_class,
    kb.student_facing,
    kb.metadata_json,
    kb.source_document,
    kb.source_section,
    (kb.embedding <=> query_embedding)::double precision as distance
  from public.knowledge_base kb
  where kb.embedding is not null
    and kb.knowledge_class <> 'tbd'
    and kb.student_facing = true
    and kb.metadata_json ->> 'normalRetrievalEligible' = 'true'
    and (requested_course_id is null and kb.course_id is null or
      requested_course_id is not null and (kb.course_id = requested_course_id or kb.course_id is null))
    and (kb.embedding <=> query_embedding) <= max_cosine_distance
  order by kb.embedding <=> query_embedding asc, kb.source_chunk_id asc
  limit least(greatest(max_results, 0), 5);
$$;
