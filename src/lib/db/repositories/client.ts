import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RepositoryClient = SupabaseClient<any>;

type RepositoryError = {
  message: string;
} | null;

export async function getRepositoryClient(
  client?: RepositoryClient,
): Promise<RepositoryClient> {
  if (client) {
    return client;
  }

  const { createSupabaseServerClient } = await import("../../supabase/server");
  return createSupabaseServerClient();
}

export function throwIfRepositoryError(
  error: RepositoryError,
  operation: string,
): void {
  if (error) {
    throw new Error(`Database ${operation} failed: ${error.message}`);
  }
}

export function requireRepositoryRecord<T>(data: T | null, operation: string): T {
  if (data === null) {
    throw new Error(`Database ${operation} failed: no record was returned.`);
  }

  return data;
}
