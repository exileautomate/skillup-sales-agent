/**
 * Server-side environment access for the application.
 *
 * Keep all direct `process.env` reads in this module. Do not import this file
 * from Client Components or expose server values with a `NEXT_PUBLIC_` prefix.
 */

/**
 * Reads a required server environment variable.
 *
 * Future modules should call this while defining their configuration so a
 * missing value fails with an actionable error when that module is used.
 */
export function getRequiredServerEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(
      `Missing required server environment variable: ${name}. Set it in the deployment environment or in the root .env.local file.`,
    );
  }

  return value;
}

/**
 * Reads an optional server environment variable.
 */
export function getOptionalServerEnv(name: string): string | undefined {
  const value = process.env[name];

  return value === undefined || value.trim() === "" ? undefined : value;
}

/**
 * Reads the Telegram bot token used by the server-side Telegram adapter.
 */
export function getTelegramBotToken(): string {
  return getRequiredServerEnv("TELEGRAM_BOT_TOKEN");
}

/**
 * Reads the secret Telegram includes with webhook requests.
 */
export function getTelegramWebhookSecret(): string {
  return getRequiredServerEnv("TELEGRAM_WEBHOOK_SECRET");
}
