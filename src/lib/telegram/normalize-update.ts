import type { NormalizedInboundMessage } from "@/core/input/types";

export type TelegramUnsupportedReason =
  | "missing-update-id"
  | "unsupported-update"
  | "missing-sender-id"
  | "missing-chat-id"
  | "missing-message-id"
  | "missing-message-date"
  | "unsupported-message";

export type TelegramNormalizationResult =
  | {
      status: "normalized";
      message: NormalizedInboundMessage;
    }
  | {
      status: "unsupported";
      reason: TelegramUnsupportedReason;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTelegramId(value: unknown): string | undefined {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? String(value)
    : undefined;
}

function readTelegramTimestamp(value: unknown): string | undefined {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return undefined;
  }

  const timestamp = new Date(value * 1_000);

  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString();
}

function toReceivedAt(receivedAt: Date): string {
  if (Number.isNaN(receivedAt.getTime())) {
    throw new Error("receivedAt must be a valid Date.");
  }

  return receivedAt.toISOString();
}

export function normalizeTelegramUpdate(
  update: unknown,
  receivedAt: Date = new Date(),
): TelegramNormalizationResult {
  if (!isRecord(update)) {
    return { status: "unsupported", reason: "missing-update-id" };
  }

  const updateId = readTelegramId(update.update_id);

  if (updateId === undefined) {
    return { status: "unsupported", reason: "missing-update-id" };
  }

  if (!isRecord(update.message)) {
    return { status: "unsupported", reason: "unsupported-update" };
  }

  const message = update.message;
  const sender = isRecord(message.from) ? message.from : undefined;
  const channelUserId = readTelegramId(sender?.id);

  if (channelUserId === undefined) {
    return { status: "unsupported", reason: "missing-sender-id" };
  }

  const chat = isRecord(message.chat) ? message.chat : undefined;
  const chatId = readTelegramId(chat?.id);

  if (chatId === undefined) {
    return { status: "unsupported", reason: "missing-chat-id" };
  }

  const messageId = readTelegramId(message.message_id);

  if (messageId === undefined) {
    return { status: "unsupported", reason: "missing-message-id" };
  }

  const timestamp = readTelegramTimestamp(message.date);

  if (timestamp === undefined) {
    return { status: "unsupported", reason: "missing-message-date" };
  }

  const common = {
    channel: "telegram" as const,
    channelUserId,
    chatId,
    messageId,
    updateId,
    timestamp,
    receivedAt: toReceivedAt(receivedAt),
  };

  if (typeof message.text === "string") {
    return {
      status: "normalized",
      message: {
        ...common,
        messageType: "text",
        text: message.text,
        voiceFileId: null,
        voiceFileUniqueId: null,
        voiceDurationSeconds: null,
      },
    };
  }

  if (
    isRecord(message.voice) &&
    typeof message.voice.file_id === "string" &&
    message.voice.file_id !== ""
  ) {
    const voiceFileUniqueId =
      typeof message.voice.file_unique_id === "string"
        ? message.voice.file_unique_id
        : null;
    const voiceDurationSeconds =
      typeof message.voice.duration === "number" &&
      Number.isSafeInteger(message.voice.duration) &&
      message.voice.duration >= 0
        ? message.voice.duration
        : null;

    return {
      status: "normalized",
      message: {
        ...common,
        messageType: "voice",
        text: null,
        voiceFileId: message.voice.file_id,
        voiceFileUniqueId,
        voiceDurationSeconds,
      },
    };
  }

  return { status: "unsupported", reason: "unsupported-message" };
}
