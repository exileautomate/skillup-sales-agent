import "server-only";

import {
  getRepositoryClient,
  requireRepositoryRecord,
  type RepositoryClient,
  throwIfRepositoryError,
} from "./client.ts";
import type {
  CreateDemoBookingInput,
  DemoBooking,
  UpdateDemoBookingInput,
  Uuid,
} from "./types.ts";

export async function getDemoBookingById(
  id: Uuid,
  client?: RepositoryClient,
): Promise<DemoBooking | null> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("demo_bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwIfRepositoryError(error, "demo booking lookup by id");
  return data as DemoBooking | null;
}

export async function createDemoBookingRecord(
  input: CreateDemoBookingInput,
  client?: RepositoryClient,
): Promise<DemoBooking> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("demo_bookings")
    .insert(input)
    .select("*")
    .single();

  throwIfRepositoryError(error, "demo booking record creation");
  return requireRepositoryRecord(data as DemoBooking | null, "demo booking record creation");
}

export async function updateDemoBooking(
  id: Uuid,
  input: UpdateDemoBookingInput,
  client?: RepositoryClient,
): Promise<DemoBooking> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("demo_bookings")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  throwIfRepositoryError(error, "demo booking update");
  return requireRepositoryRecord(data as DemoBooking | null, "demo booking update");
}
