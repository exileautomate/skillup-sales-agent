import "server-only";

import { getTelegramBotToken } from "@/config/env";

export type TelegramChatId = number | string;

export type TelegramMessage = {
  message_id: number;
  date: number;
  chat: {
    id: number;
    type: string;
  };
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTelegramApiResponse(
  value: unknown,
): value is TelegramApiResponse<unknown> {
  return isRecord(value) && typeof value.ok === "boolean";
}

function isTelegramMessage(value: unknown): value is TelegramMessage {
  if (!isRecord(value) || !isRecord(value.chat)) {
    return false;
  }

  return (
    typeof value.message_id === "number" &&
    typeof value.date === "number" &&
    typeof value.chat.id === "number" &&
    typeof value.chat.type === "string"
  );
}

function formatTelegramFailure(
  response: Response,
  payload: TelegramApiResponse<unknown> | undefined,
): string {
  const details = [
    `HTTP ${response.status}`,
    payload?.error_code === undefined ? undefined : `code ${payload.error_code}`,
    payload?.description,
  ].filter((detail): detail is string => detail !== undefined);

  return `Telegram sendMessage failed: ${details.join("; ")}`;
}

/**
 * Sends a plain-text Telegram message from the configured bot.
 */
export async function sendTelegramTextMessage(
  chatId: TelegramChatId,
  text: string,
): Promise<TelegramMessage> {
  if (typeof chatId === "string" && chatId.trim() === "") {
    throw new Error("Telegram chat ID must not be empty.");
  }

  if (typeof chatId === "number" && !Number.isFinite(chatId)) {
    throw new Error("Telegram chat ID must be a finite number.");
  }

  if (text.trim() === "") {
    throw new Error("Telegram message text must not be empty.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${getTelegramBotToken()}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      cache: "no-store",
    },
  );

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error(`Telegram sendMessage returned invalid JSON (HTTP ${response.status}).`);
  }

  const telegramResponse = isTelegramApiResponse(payload) ? payload : undefined;

  if (!response.ok || telegramResponse?.ok !== true) {
    throw new Error(formatTelegramFailure(response, telegramResponse));
  }

  if (!isTelegramMessage(telegramResponse.result)) {
    throw new Error("Telegram sendMessage returned an unexpected success payload.");
  }

  return telegramResponse.result;
}
