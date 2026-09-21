import "server-only";

import {
  getRepositoryClient,
  type RepositoryClient,
  throwIfRepositoryError,
} from "./client.ts";
import type { Branch, Uuid } from "./types.ts";

export async function getBranchById(
  id: Uuid,
  client?: RepositoryClient,
): Promise<Branch | null> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("branches")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwIfRepositoryError(error, "branch lookup by id");
  return data as Branch | null;
}

export async function getBranchByName(
  name: string,
  client?: RepositoryClient,
): Promise<Branch | null> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("branches")
    .select("*")
    .eq("name", name)
    .maybeSingle();

  throwIfRepositoryError(error, "branch lookup by name");
  return data as Branch | null;
}

export async function listBranches(client?: RepositoryClient): Promise<Branch[]> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("branches")
    .select("*")
    .order("name", { ascending: true });

  throwIfRepositoryError(error, "branch listing");
  return (data ?? []) as Branch[];
}

export async function getActiveBranchesForCourse(
  courseId: Uuid,
  client?: RepositoryClient,
): Promise<Branch[]> {
  const { data, error } = await (await getRepositoryClient(client))
    .from("course_branches")
    .select("branch:branches(*)")
    .eq("course_id", courseId)
    .eq("is_active", true);

  throwIfRepositoryError(error, "active branches lookup by course");

  return ((data ?? []) as unknown as Array<{ branch: Branch | Branch[] | null }>)
    .flatMap(({ branch }) => {
      if (branch === null) {
        return [];
      }

      return Array.isArray(branch) ? branch : [branch];
    })
    .sort((first, second) => first.name.localeCompare(second.name));
}
