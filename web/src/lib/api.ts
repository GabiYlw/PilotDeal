import "server-only";
import type { ApiErrorBody, HealthStatus } from "./types";

// status 0 means no HTTP response was received (API not running, DNS, refused connection).
export const API_UNREACHABLE = "API_UNREACHABLE";
// The API answered with an error status but not with its usual { error } body.
export const UNEXPECTED_RESPONSE = "UNEXPECTED_RESPONSE";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  // Non-2xx statuses whose body is a valid response, not an error (for example 503 on /health).
  acceptStatuses?: number[];
}

// Read on every call, not at import time, so the value comes from the runtime environment.
function apiBaseUrl(): string {
  const url = process.env.API_URL;
  if (!url) {
    throw new Error("API_URL is not set. Copy web/.env.example to web/.env.local.");
  }
  return url.replace(/\/+$/, "");
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return false;
  }
  const { error } = body;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  if (isApiErrorBody(body)) {
    return new ApiError(body.error.message, status, body.error.code, body.error.details);
  }
  return new ApiError(`API responded with status ${status}`, status, UNEXPECTED_RESPONSE);
}

async function send(url: string, options: RequestOptions): Promise<Response> {
  const hasBody = options.body !== undefined;
  try {
    return await fetch(url, {
      method: options.method ?? "GET",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw new ApiError(`Cannot reach the API at ${url}`, 0, API_UNREACHABLE, String(error));
  }
}

// The response type is trusted, not validated: lib/types.ts mirrors the API, which owns the shapes.
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(`${apiBaseUrl()}${path}`, options);
  const body = await readJson(response);
  const accepted = response.ok || (options.acceptStatuses ?? []).includes(response.status);
  if (!accepted) {
    throw toApiError(response.status, body);
  }
  return body as T;
}

export function getHealth(): Promise<HealthStatus> {
  return apiRequest<HealthStatus>("/health", { acceptStatuses: [503] });
}
