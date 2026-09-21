import "server-only";

import {
  getRepositoryClient,
  type RepositoryClient,
  throwIfRepositoryError,
} from "./client.ts";
import type { Course, Uuid } from "./types.ts";

export async function getCourseById(
  id: Uuid,
  client?: RepositoryClient,
): Promise<Course | null> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("courses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwIfRepositoryError(error, "course lookup by id");
  return data as Course | null;
}

export async function getCourseBySlug(
  slug: string,
  client?: RepositoryClient,
): Promise<Course | null> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  throwIfRepositoryError(error, "course lookup by slug");
  return data as Course | null;
}

export async function getCourseByInternalName(
  internalName: string,
  client?: RepositoryClient,
): Promise<Course | null> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("courses")
    .select("*")
    .eq("internal_name", internalName)
    .maybeSingle();

  throwIfRepositoryError(error, "course lookup by internal name");
  return data as Course | null;
}

export async function listCourses(client?: RepositoryClient): Promise<Course[]> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("courses")
    .select("*")
    .order("student_facing_name", { ascending: true });

  throwIfRepositoryError(error, "course listing");
  return (data ?? []) as Course[];
}
