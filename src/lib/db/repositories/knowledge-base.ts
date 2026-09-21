import "server-only";

import {
  getRepositoryClient,
  type RepositoryClient,
  throwIfRepositoryError,
} from "./client.ts";
import type { KnowledgeBaseFilters, KnowledgeBaseRecord, Uuid } from "./types.ts";

export async function getKnowledgeBaseRecordById(
  id: Uuid,
  client?: RepositoryClient,
): Promise<KnowledgeBaseRecord | null> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("knowledge_base")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwIfRepositoryError(error, "knowledge-base record lookup by id");
  return data as KnowledgeBaseRecord | null;
}

export async function listKnowledgeBaseRecords(
  filters: KnowledgeBaseFilters = {},
  client?: RepositoryClient,
): Promise<KnowledgeBaseRecord[]> {
  let query = (await getRepositoryClient(client))
    .from("knowledge_base")
    .select("*");

  if (filters.course_id !== undefined) {
    query = query.eq("course_id", filters.course_id);
  }

  if (filters.category !== undefined) {
    query = query.eq("category", filters.category);
  }

  if (filters.intent !== undefined) {
    query = query.eq("intent", filters.intent);
  }

  if (filters.knowledge_class !== undefined) {
    query = query.eq("knowledge_class", filters.knowledge_class);
  }

  if (filters.student_facing !== undefined) {
    query = query.eq("student_facing", filters.student_facing);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  throwIfRepositoryError(error, "knowledge-base record listing");
  return (data ?? []) as KnowledgeBaseRecord[];
}
