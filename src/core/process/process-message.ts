import type { NormalizedInboundMessage } from "../input/types.ts";
import {
  orchestrateTextTurn,
  type OrchestrateTextTurnDependencies,
} from "../orchestration/orchestrate-text-turn.ts";
import {
  getOrCreateConversationForLead,
  type ConversationPersistenceDependencies,
} from "../conversation/conversation-persistence.ts";
import {
  getOrCreateLeadByChannelIdentity,
  type LeadPersistenceDependencies,
} from "../lead/lead-persistence.ts";

export type CoreTextMessage = {
  type: "text";
  content: string;
};

export type ProcessMessageResult =
  | {
      status: "completed";
      messages: readonly [CoreTextMessage];
    }
  | {
      status: "unsupported";
      reason: "voice-not-supported";
      messages: readonly [];
    };

export type ProcessMessageDependencies = {
  identifyOrCreateLead?: (
    channel: string,
    channelUserId: string,
    dependencies?: LeadPersistenceDependencies,
  ) => ReturnType<typeof getOrCreateLeadByChannelIdentity>;
  getOrCreateConversationForLead?: (
    leadId: string,
    channel: string,
    dependencies?: ConversationPersistenceDependencies,
  ) => ReturnType<typeof getOrCreateConversationForLead>;
  orchestrateTextTurn?: typeof orchestrateTextTurn;
  orchestrationDependencies?: OrchestrateTextTurnDependencies;
};

const PHASE_ONE_GREETING =
  "Hi, Saleel here from SkillUp. Eth course aan nokkunne?";

export async function processMessage(
  message: NormalizedInboundMessage,
  dependencies: ProcessMessageDependencies = {},
): Promise<ProcessMessageResult> {
  const lead = await (
    dependencies.identifyOrCreateLead ?? getOrCreateLeadByChannelIdentity
  )(
    message.channel,
    message.channelUserId,
  );
  const conversation = await (
    dependencies.getOrCreateConversationForLead ??
    getOrCreateConversationForLead
  )(lead.id, message.channel);

  if (message.messageType === "voice") {
    return {
      status: "unsupported",
      reason: "voice-not-supported",
      messages: [],
    };
  }

  await (dependencies.orchestrateTextTurn ?? orchestrateTextTurn)(
    { message, lead, conversation },
    dependencies.orchestrationDependencies,
  );

  return {
    status: "completed",
    messages: [
      {
        type: "text",
        content: PHASE_ONE_GREETING,
      },
    ],
  };
}
