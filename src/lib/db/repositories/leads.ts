import "server-only";

import {
  getRepositoryClient,
  requireRepositoryRecord,
  type RepositoryClient,
  throwIfRepositoryError,
} from "./client.ts";
import type { CreateLeadInput, Lead, Uuid, UpdateLeadInput } from "./types.ts";

export async function findLeadByChannelUserId(
  channel: string,
  channelUserId: string,
  client?: RepositoryClient,
): Promise<Lead | null> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("leads")
    .select("*")
    .eq("channel", channel)
    .eq("channel_user_id", channelUserId)
    .maybeSingle();

  throwIfRepositoryError(error, "lead lookup by channel identity");
  return data as Lead | null;
}

export async function createLead(
  input: CreateLeadInput,
  client?: RepositoryClient,
): Promise<Lead> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("leads")
    .insert(input)
    .select("*")
    .single();

  throwIfRepositoryError(error, "lead creation");
  return requireRepositoryRecord(data as Lead | null, "lead creation");
}

export async function updateLead(
  id: Uuid,
  input: UpdateLeadInput,
  client?: RepositoryClient,
): Promise<Lead> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("leads")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  throwIfRepositoryError(error, "lead update");
  return requireRepositoryRecord(data as Lead | null, "lead update");
}
