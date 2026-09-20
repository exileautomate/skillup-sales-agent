/**
 * Creates an opaque correlation ID for one server request.
 */
export function createRequestId(): string {
  return crypto.randomUUID();
}
