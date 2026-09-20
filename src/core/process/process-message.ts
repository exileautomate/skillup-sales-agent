import type { NormalizedInboundMessage } from "@/core/input/types";

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

const PHASE_ONE_GREETING =
  "Hi, Saleel here from SkillUp. Eth course aan nokkunne?";

export async function processMessage(
  message: NormalizedInboundMessage,
): Promise<ProcessMessageResult> {
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
