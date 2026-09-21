import "server-only";

import {
  getRepositoryClient,
  requireRepositoryRecord,
  type RepositoryClient,
  throwIfRepositoryError,
} from "./client.ts";
import type {
  Conversation,
  CreateConversationInput,
  UpdateConversationInput,
  Uuid,
} from "./types.ts";

export async function getConversationById(
  id: Uuid,
  client?: RepositoryClient,
): Promise<Conversation | null> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwIfRepositoryError(error, "conversation lookup by id");
  return data as Conversation | null;
}

export async function listConversationsForLead(
  leadId: Uuid,
  client?: RepositoryClient,
): Promise<Conversation[]> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("conversations")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  throwIfRepositoryError(error, "conversation listing by lead");
  return (data ?? []) as Conversation[];
}

export async function createConversation(
  input: CreateConversationInput,
  client?: RepositoryClient,
): Promise<Conversation> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("conversations")
    .insert(input)
    .select("*")
    .single();

  throwIfRepositoryError(error, "conversation creation");
  return requireRepositoryRecord(data as Conversation | null, "conversation creation");
}

export async function updateConversation(
  id: Uuid,
  input: UpdateConversationInput,
  client?: RepositoryClient,
): Promise<Conversation> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("conversations")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  throwIfRepositoryError(error, "conversation update");
  return requireRepositoryRecord(data as Conversation | null, "conversation update");
}
