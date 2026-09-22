import type { Conversation, Uuid } from "../../lib/db/repositories/types.ts";
import {
  createConversation,
  findLatestConversationForLeadChannel,
} from "../../lib/db/repositories/conversations.ts";

export type ConversationPersistenceDependencies = {
  findLatestConversationForLeadChannel: typeof findLatestConversationForLeadChannel;
  createConversation: typeof createConversation;
};

const defaultDependencies: ConversationPersistenceDependencies = {
  findLatestConversationForLeadChannel,
  createConversation,
};

/**
 * Resolves the newest stored conversation for one lead and channel, creating
 * a neutral database-default conversation only when none exists.
 */
export async function getOrCreateConversationForLead(
  leadId: Uuid,
  channel: string,
  dependencies: ConversationPersistenceDependencies = defaultDependencies,
): Promise<Conversation> {
  const existingConversation =
    await dependencies.findLatestConversationForLeadChannel(leadId, channel);

  if (existingConversation !== null) {
    return existingConversation;
  }

  return dependencies.createConversation({
    lead_id: leadId,
    channel,
  });
}
