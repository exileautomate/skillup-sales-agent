# Module 9 — Logging & Error Utilities Implementation Report

## Module objective

Establish a small demo/MVP foundation for opaque request IDs, structured server logging, typed application errors, and safe webhook-boundary observability. This module intentionally adds no external observability service, persistence, business logic, Telegram delivery, or future orchestration.

## Repository state before implementation

The repository already contained the completed Modules 1–8: centralized environment access, separate Supabase and Telegram clients, a secret-validated Telegram webhook with normalization only, the normalized input contract, the pure Module 8 processor skeleton, and the health endpoint.

Before Module 9, the webhook returned its existing HTTP bodies/statuses but had no request-correlation header or structured boundary logging. `package.json` already contained only the established project dependencies, including `@supabase/supabase-js` and `server-only` from earlier modules.

## Files inspected

- `AGENTS.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- `src/app/api/telegram/webhook/route.ts`
- `src/app/api/health/route.ts`
- `src/config/env.ts`
- `src/core/process/process-message.ts`
- `src/lib/telegram/normalize-update.ts`
- `src/lib/telegram/client.ts`
- `src/lib/supabase/server.ts`
- `tests/input-normalization.test.mjs`
- `tests/process-message.test.mjs`
- `package.json`
- `tsconfig.json`
- `eslint.config.mjs`
- `.gitignore`

## Files created

- `src/lib/request/request-id.ts`
- `src/lib/logging/logger.ts`
- `src/lib/errors/app-error.ts`
- `tests/logging-error-utilities.test.mjs`
- `MODULE_9_LOGGING_ERROR_UTILITIES_IMPLEMENTATION_REPORT.md`

## Files modified

- `src/app/api/telegram/webhook/route.ts`

No other implementation files were modified. The health route, core processor, normalization layer, Telegram outbound client, Supabase client, configuration, and dependency manifests were left unchanged for this module.

## Dependencies added or changed

None. The request ID uses the platform built-in `crypto.randomUUID()` and logging uses the existing runtime `console`; no UUID, logging, monitoring, telemetry, or error-handling package was installed.

## Request ID implementation

`src/lib/request/request-id.ts` exports:

```ts
createRequestId(): string
```

It returns `crypto.randomUUID()`: an opaque, secure runtime UUID that is not derived from any user, chat, request-header, or message value. Every webhook request creates its request ID once at the beginning of `POST` and reuses that same value in the event log and response header.

## Logger API and exact log shape

`src/lib/logging/logger.ts` exports `logger.info`, `logger.warn`, and `logger.error`. Each accepts an event string and an optional context:

```ts
logger.info(event, {
  requestId?: string,
  metadata?: Record<string, string | number | boolean | null>,
})
```

The logger serializes one JSON record to the appropriate console method. Its stable shape is:

```ts
{
  timestamp: string,
  level: "info" | "warn" | "error",
  event: string,
  requestId?: string,
  metadata?: Record<string, string | number | boolean | null>,
}
```

For example, the webhook success event is structurally equivalent to:

```json
{
  "timestamp": "2026-09-18T...Z",
  "level": "info",
  "event": "telegram_webhook_processed",
  "requestId": "generated UUID",
  "metadata": { "normalized": true, "messageType": "text" }
}
```

The only `console.info`, `console.warn`, and `console.error` calls added are inside this logger utility. The webhook itself never calls `console` directly.

## Secret and privacy logging rules

The logging API accepts primitive safe metadata rather than request/update/error objects. It applies a small, testable redaction list for obvious sensitive/private keys after normalizing spelling/casing separators. This redacts keys for tokens, secrets, API keys, Authorization, cookies, environment/configuration dumps, headers, raw bodies/updates, message/text content, and voice file IDs. Unexpected non-primitive JavaScript values are represented as `[OMITTED]` rather than serialized.

Webhook log calls pass only these safe values:

- rejected requests: a fixed safe reason (`unauthorized`, `malformed-json`, or `invalid-envelope`);
- normalized requests: `normalized: true` and the discriminant `messageType` only;
- ordinary unsupported updates: `normalized: false` and the normalizer's already-safe reason.

The route does not log the received secret, any request headers, raw body, raw Telegram update, normalized object, student text, voice file ID, bot token, Supabase key, or configuration value. It also does not pass errors or stack traces to ordinary info logs.

## Typed error contract

`src/lib/errors/app-error.ts` exports:

```ts
class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly cause?: unknown;
}

isAppError(error: unknown): error is AppError
```

The constructor takes `{ code, message, statusCode, cause? }`. It preserves a stable machine-readable code, a caller-provided safe message, relevant HTTP status, and optional internal cause without creating speculative subclasses or taxonomy. The existing webhook did not need an AppError refactor, so no behavior was forced merely to consume the new utility.

## Telegram webhook integration changes

`src/app/api/telegram/webhook/route.ts` now creates one request ID before secret validation and returns every normal route response through a small local `webhookResponse` helper. That helper adds:

```text
x-request-id: <same UUID used by that request's log event>
```

The existing bodies and HTTP statuses remain unchanged:

| Request outcome | Status | Body behavior |
| --- | ---: | --- |
| Missing/invalid secret | 401 | `{ ok: false, error: "Unauthorized" }` |
| Malformed JSON | 400 | `{ ok: false, error: "Malformed JSON body" }` |
| Invalid envelope | 400 | `{ ok: false, error: "Invalid Telegram update payload" }` |
| Normalized input | 200 | `{ ok: true, normalized: true }` |
| Ordinary unsupported update | 200 | `{ ok: true, normalized: false }` |

The single lexical `requestId` is passed to both the corresponding logger call and response helper, preserving request-level correlation without adding a propagation framework.

## processMessage isolation confirmation

`src/core/process/process-message.ts` was not modified. It still imports only `NormalizedInboundMessage` as a type and has no references to `logger`, `requestId`, `AppError`, Telegram, configuration, Supabase, providers, I/O, or infrastructure. Module 8 remains effectively pure and deterministic.

## Health endpoint confirmation

`src/app/api/health/route.ts` was not modified. It remains a quiet deterministic endpoint returning exactly:

```json
{ "ok": true, "status": "healthy" }
```

No health logging or external health check was added.

## Tests executed

### Module 9, Module 6, and Module 8 test suites

Command:

```powershell
& 'C:\nvm4w\nodejs\node.exe' --experimental-default-type=module --test tests/input-normalization.test.mjs tests/process-message.test.mjs tests/logging-error-utilities.test.mjs
```

Exact aggregate result:

```text
tests 20
pass 20
fail 0
cancelled 0
skipped 0
todo 0
```

Module 9's four permanent tests passed:

- non-empty distinct UUID-format request IDs;
- `AppError` fields, `Error` behavior, cause, and `isAppError`;
- captured JSON-safe logger shape, level/event/request ID/safe metadata preservation; and
- redaction of fake token and fake private-text metadata before console output.

Module 6 regression: all 11 normalization tests passed.

Module 8 regression: all 5 processor tests passed.

### Controlled local webhook integration checks

Two isolated local Next server runs used only a synthetic test webhook secret and synthetic message content. No configured secret was read, printed, or sent in the report.

Validated accepted text request result:

```text
WEBHOOK_HTTP_INTEGRATION=PASS
VALID_STATUS=200
VALID_RESPONSE={"ok":true,"normalized":true}
VALID_REQUEST_ID_PRESENT=true
UNAUTHORIZED_STATUS=401
UNAUTHORIZED_REQUEST_ID_PRESENT=true
```

Validated existing error/unsupported status behavior:

```text
WEBHOOK_ERROR_STATUS_REGRESSION=PASS
MALFORMED_JSON_STATUS=400
INVALID_ENVELOPE_STATUS=400
UNSUPPORTED_STATUS=200
ALL_RESPONSES_HAVE_REQUEST_ID=true
```

The route-source review confirms successful normalization logs only `normalized` and `messageType`, while unauthorized logging passes only fixed `reason: "unauthorized"`; neither includes message content or the supplied secret. The permanent logger test independently confirms sensitive metadata is redacted before reaching console output.

### Lint

Command:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' run lint
```

Exact result:

```text
> skillup-sales-agent@0.1.0 lint
> eslint
```

Exit status: 0. ESLint reported no violations.

### Production build

Command:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' run build
```

Exact relevant result:

```text
▲ Next.js 16.3.5 (Turbopack)
✓ Compiled successfully in 4.9s
Finished TypeScript in 2.4s
✓ Generating static pages using 7 workers (6/6)
```

Exit status: 0. The production route table includes both `/api/health` and `/api/telegram/webhook`.

## Security review findings

The changed Module 9 source/test files were searched for `console`, `process.env`, Telegram/Supabase secret names, `Authorization`, private-message fields, raw updates, and headers.

- `console.*` appears only in `src/lib/logging/logger.ts`, where it receives JSON records after metadata sanitization, and in tests where console methods are temporarily captured.
- Sensitive-key strings such as `authorization`, `headers`, `rawupdate`, `supabasepublishablekey`, and `voicefileid` appear only in the logger's redaction set.
- The webhook's only request-header operation is reading `x-telegram-bot-api-secret-token` for comparison. It does not log that value.
- No `process.env` access, configured secret reference, or `Authorization` value was added to Module 9 implementation code.
- `processMessage` has no Module 9 references.

No secret, token, message-content, raw-update, environment-dump, or header logging issue was found.

## Warnings or unresolved issues

No implementation warnings or unresolved issues.

One attempted temporary server-output capture could not read its redirected files because `C:\tmp` did not exist. It did not affect source files or the working tree. The controlled local HTTP assertions were then rerun successfully without output redirection; privacy behavior is additionally covered by the permanent logger-redaction test and source-level webhook metadata inspection.

## Module 10+ scope confirmation

Module 9 did not implement Module 10 or later work. In particular, it did not connect `processMessage` to the webhook, send Telegram responses, configure/set a Telegram webhook, deploy to Vercel, use Supabase persistence, add OpenAI/Sarvam/STT/TTS, implement RAG, or add business/sales logic.

## Module 9 Completion Evidence

| Requirement | Concrete evidence |
| --- | --- |
| Built-in unique request IDs | `src/lib/request/request-id.ts` calls `crypto.randomUUID()`; `tests/logging-error-utilities.test.mjs` verifies distinct UUIDs. |
| No UUID dependency | `package.json` was unchanged; no UUID package exists. |
| Structured info/warn/error logger | `src/lib/logging/logger.ts` exports all three methods and `StructuredLogRecord`. |
| Stable JSON log fields | `createLogRecord` supplies timestamp, level, event, optional requestId, and optional sanitized metadata. |
| Privacy-safe logger | `sanitizeMetadata` and `SENSITIVE_METADATA_KEYS` in `src/lib/logging/logger.ts`; permanent redaction test verifies fake sensitive values never reach captured console output. |
| Typed reusable application error | `src/lib/errors/app-error.ts` defines `AppError` and `isAppError`; permanent test verifies code, status, Error inheritance, and cause. |
| One webhook request ID, response correlation | `src/app/api/telegram/webhook/route.ts` creates `requestId` once and `webhookResponse` sets `x-request-id`; local HTTP checks verified it on 200, 400, and 401 outcomes. |
| Safe webhook events | The webhook logger calls contain only fixed reasons, normalized boolean, normalizer-safe reason, and message type; no raw body/headers/text/voice ID are passed. |
| Existing HTTP behavior preserved | Local integration checks verified 200 normalized, 401 unauthorized, 400 malformed JSON, 400 invalid envelope, and 200 unsupported. |
| Module 8 purity preserved | `src/core/process/process-message.ts` remains unchanged and has no logging/request/error import. |
| Health unchanged | `src/app/api/health/route.ts` remains untouched and production build lists `/api/health`. |
| No dependency/scope creep | Unchanged `package.json`, source search, 20 passing tests, lint success, and production build success. |
