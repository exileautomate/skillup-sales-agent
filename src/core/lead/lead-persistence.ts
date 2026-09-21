import type { Lead } from "../../lib/db/repositories/types.ts";
import {
  createLead,
  findLeadByChannelUserId,
} from "../../lib/db/repositories/leads.ts";

export type LeadPersistenceDependencies = {
  findLeadByChannelUserId: typeof findLeadByChannelUserId;
  createLead: typeof createLead;
};

const defaultDependencies: LeadPersistenceDependencies = {
  findLeadByChannelUserId,
  createLead,
};

function isChannelIdentityConflict(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const databaseError = error as Error & {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const errorText = [
    databaseError.message,
    databaseError.details,
    databaseError.hint,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    errorText.includes("leads_channel_channel_user_id_key") ||
    (databaseError.code === "23505" &&
      errorText.includes("channel") &&
      errorText.includes("channel_user_id"))
  );
}

/**
 * Resolves one stable lead for a normalized channel identity.
 *
 * Only the identity fields are sent on creation. Existing lead rows are
 * returned untouched so later lead memory cannot be erased by an inbound
 * message.
 */
export async function getOrCreateLeadByChannelIdentity(
  channel: string,
  channelUserId: string,
  dependencies: LeadPersistenceDependencies = defaultDependencies,
): Promise<Lead> {
  const existingLead = await dependencies.findLeadByChannelUserId(
    channel,
    channelUserId,
  );

  if (existingLead !== null) {
    return existingLead;
  }

  try {
    return await dependencies.createLead({
      channel,
      channel_user_id: channelUserId,
    });
  } catch (error) {
    if (!isChannelIdentityConflict(error)) {
      throw error;
    }

    const racedLead = await dependencies.findLeadByChannelUserId(
      channel,
      channelUserId,
    );

    if (racedLead !== null) {
      return racedLead;
    }

    throw error;
  }
}
