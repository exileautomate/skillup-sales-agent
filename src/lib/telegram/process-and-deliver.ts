import type { NormalizedInboundMessage } from "@/core/input/types";
import type { ProcessMessageResult } from "@/core/process/process-message";

export type ProcessNormalizedMessage = (
  message: NormalizedInboundMessage,
) => Promise<ProcessMessageResult>;

export type SendTelegramText = (
  chatId: string,
  text: string,
) => Promise<unknown>;

type TelegramProcessingDependencies = {
  processMessage: ProcessNormalizedMessage;
  sendTelegramTextMessage: SendTelegramText;
};

/**
 * Bridges a normalized inbound message to the channel adapter without giving
 * the core processor any Telegram transport responsibility.
 */
export async function processAndDeliverTelegramResponse(
  message: NormalizedInboundMessage,
  dependencies: TelegramProcessingDependencies,
): Promise<ProcessMessageResult> {
  const result = await dependencies.processMessage(message);

  if (result.status !== "completed") {
    return result;
  }

  for (const outboundMessage of result.messages) {
    await dependencies.sendTelegramTextMessage(
      message.chatId,
      outboundMessage.content,
    );
  }

  return result;
}
