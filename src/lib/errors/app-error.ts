export type AppErrorOptions = {
  code: string;
  message: string;
  statusCode: number;
  cause?: unknown;
};

/**
 * A small, stable application error for future boundary-level error handling.
 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly cause?: unknown;

  constructor({ code, message, statusCode, cause }: AppErrorOptions) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
