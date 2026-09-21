import type { NormalizedInboundMessage } from "../input/types.ts";
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
};

const PHASE_ONE_GREETING =
  "Hi, Saleel here from SkillUp. Eth course aan nokkunne?";

export async function processMessage(
  message: NormalizedInboundMessage,
  dependencies: ProcessMessageDependencies = {},
): Promise<ProcessMessageResult> {
  await (dependencies.identifyOrCreateLead ?? getOrCreateLeadByChannelIdentity)(
    message.channel,
    message.channelUserId,
  );

  if (message.messageType === "voice") {
    return {
      status: "unsupported",
      reason: "voice-not-supported",
      messages: [],
    };
  }

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
