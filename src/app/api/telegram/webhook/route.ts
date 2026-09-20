import { getTelegramWebhookSecret } from "@/config/env";
import { processMessage } from "@/core/process/process-message";
import { logger } from "@/lib/logging/logger";
import { createRequestId } from "@/lib/request/request-id";
import { normalizeTelegramUpdate } from "@/lib/telegram/normalize-update";
import { processAndDeliverTelegramResponse } from "@/lib/telegram/process-and-deliver";
import { sendTelegramTextMessage } from "@/lib/telegram/client";

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

type TelegramUpdateEnvelope = {
  update_id: number;
  [key: string]: unknown;
};

function isTelegramUpdateEnvelope(
  value: unknown,
): value is TelegramUpdateEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "update_id" in value &&
    typeof value.update_id === "number" &&
    Number.isSafeInteger(value.update_id)
  );
}

function webhookResponse(
  body: Record<string, boolean | string>,
  status: number,
  requestId: string,
): Response {
  return Response.json(body, {
    status,
    headers: { "x-request-id": requestId },
  });
}

export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const receivedSecret = request.headers.get(TELEGRAM_SECRET_HEADER);

  if (receivedSecret !== getTelegramWebhookSecret()) {
    logger.warn("telegram_webhook_rejected", {
      requestId,
      metadata: { reason: "unauthorized" },
    });
    return webhookResponse({ ok: false, error: "Unauthorized" }, 401, requestId);
  }

  let update: unknown;

  try {
    update = await request.json();
  } catch {
    logger.warn("telegram_webhook_rejected", {
      requestId,
      metadata: { reason: "malformed-json" },
    });
    return webhookResponse(
      { ok: false, error: "Malformed JSON body" },
      400,
      requestId,
    );
  }

  if (!isTelegramUpdateEnvelope(update)) {
    logger.warn("telegram_webhook_rejected", {
      requestId,
      metadata: { reason: "invalid-envelope" },
    });
    return webhookResponse(
      { ok: false, error: "Invalid Telegram update payload" },
      400,
      requestId,
    );
  }

  const normalization = normalizeTelegramUpdate(update);

  if (normalization.status === "unsupported") {
    logger.info("telegram_webhook_unsupported_update", {
      requestId,
      metadata: { normalized: false, reason: normalization.reason },
    });

    return webhookResponse({ ok: true, normalized: false }, 200, requestId);
  }

  const normalizedMessage = normalization.message;

  logger.info("telegram_webhook_processed", {
    requestId,
    metadata: {
      normalized: true,
      messageType: normalizedMessage.messageType,
    },
  });

  try {
    const result = await processAndDeliverTelegramResponse(normalizedMessage, {
      processMessage,
      sendTelegramTextMessage,
    });

    if (result.status === "completed") {
      logger.info("telegram_response_sent", {
        requestId,
        metadata: {
          messageType: normalizedMessage.messageType,
          messageCount: result.messages.length,
        },
      });
    } else {
      logger.info("telegram_response_not_sent", {
        requestId,
        metadata: { reason: result.reason },
      });
    }

    return webhookResponse({ ok: true, normalized: true }, 200, requestId);
  } catch {
    logger.error("telegram_response_delivery_failed", {
      requestId,
      metadata: { reason: "outbound-delivery-failed" },
    });
    return webhookResponse(
      { ok: false, error: "Telegram response delivery failed" },
      502,
      requestId,
    );
  }
}
