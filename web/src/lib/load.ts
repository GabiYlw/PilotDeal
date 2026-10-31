import "server-only";
import { notFound } from "next/navigation";
import { ApiError } from "./api";

export type LoadResult<T> = { status: "ok"; data: T } | { status: "unreachable" };

function isUnreachable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

// A missing id (404) or a malformed one (400 VALIDATION_ERROR) both mean "no such page".
function isMissing(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 || (error.status === 400 && error.code === "VALIDATION_ERROR"))
  );
}

// By-id lookups: missing -> notFound(); API down -> "unreachable"; anything else is rethrown.
export async function loadResource<T>(request: Promise<T>): Promise<LoadResult<T>> {
  try {
    return { status: "ok", data: await request };
  } catch (error) {
    if (isMissing(error)) notFound();
    if (isUnreachable(error)) return { status: "unreachable" };
    throw error;
  }
}

export type OptionalLoadResult<T> = LoadResult<T> | { status: "missing" };

// Like loadResource, but a missing or malformed id is a normal result, not a 404 page.
export async function loadOptionalResource<T>(
  request: Promise<T>,
): Promise<OptionalLoadResult<T>> {
  try {
    return { status: "ok", data: await request };
  } catch (error) {
    if (isMissing(error)) return { status: "missing" };
    if (isUnreachable(error)) return { status: "unreachable" };
    throw error;
  }
}

// Lists: API down -> "unreachable"; anything else is rethrown.
export async function loadCollection<T>(request: Promise<T>): Promise<LoadResult<T>> {
  try {
    return { status: "ok", data: await request };
  } catch (error) {
    if (isUnreachable(error)) return { status: "unreachable" };
    throw error;
  }
}
