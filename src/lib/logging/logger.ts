export type LogLevel = "info" | "warn" | "error";

export type SafeLogValue = boolean | number | string | null;

export type LogContext = {
  requestId?: string;
  metadata?: Readonly<Record<string, SafeLogValue>>;
};

export type StructuredLogRecord = {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  metadata?: Record<string, SafeLogValue>;
};

const REDACTED_VALUE = "[REDACTED]";
const OMITTED_VALUE = "[OMITTED]";

const SENSITIVE_METADATA_KEYS = new Set([
  "apikey",
  "authorization",
  "body",
  "cookie",
  "env",
  "environment",
  "headers",
  "message",
  "openaiapikey",
  "password",
  "rawbody",
  "rawupdate",
  "requestheaders",
  "sarvamapikey",
  "secret",
  "setcookie",
  "supabasepublishablekey",
  "telegrambottoken",
  "telegramwebhooksecret",
  "text",
  "token",
  "update",
  "voicefileid",
]);

function normalizeMetadataKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function sanitizeMetadata(
  metadata: LogContext["metadata"],
): Record<string, SafeLogValue> | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (SENSITIVE_METADATA_KEYS.has(normalizeMetadataKey(key))) {
        return [key, REDACTED_VALUE];
      }

      return [
        key,
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
          ? value
          : OMITTED_VALUE,
      ];
    }),
  );
}

export function createLogRecord(
  level: LogLevel,
  event: string,
  context: LogContext = {},
): StructuredLogRecord {
  const metadata = sanitizeMetadata(context.metadata);

  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
    ...(metadata === undefined ? {} : { metadata }),
  };
}

function writeLog(level: LogLevel, event: string, context?: LogContext): void {
  const record = createLogRecord(level, event, context);
  const output = JSON.stringify(record);

  if (level === "info") {
    console.info(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.error(output);
  }
}

export const logger = {
  info(event: string, context?: LogContext): void {
    writeLog("info", event, context);
  },
  warn(event: string, context?: LogContext): void {
    writeLog("warn", event, context);
  },
  error(event: string, context?: LogContext): void {
    writeLog("error", event, context);
  },
};
