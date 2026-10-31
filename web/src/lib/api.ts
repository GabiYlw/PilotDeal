import "server-only";
import type {
  ApiErrorBody,
  AskBody,
  AskResponse,
  Company,
  CompanyBody,
  Contact,
  ContactBody,
  CreateDealBody,
  CreateInteractionBody,
  Deal,
  DealNextAction,
  HealthStatus,
  Interaction,
  PageQuery,
  Paginated,
  PrioritizedDeal,
  UpdateDealBody,
  UpdateInteractionBody,
} from "./types";

// status 0 means no HTTP response was received (API not running, DNS, refused connection).
export const API_UNREACHABLE = "API_UNREACHABLE";
// The API answered with an error status but not with its usual { error } body.
export const UNEXPECTED_RESPONSE = "UNEXPECTED_RESPONSE";

// The next-action endpoint answers 409 with this code for a WON or LOST deal.
export const DEAL_CLOSED = "DEAL_CLOSED";

// /ask answers 503 with this code while the embedding model cannot be used.
export const EMBEDDING_UNAVAILABLE = "EMBEDDING_UNAVAILABLE";

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

function pageQuery({ page, pageSize }: PageQuery): string {
  return `?page=${page}&pageSize=${pageSize}`;
}

function dealPath(id: string): string {
  return `/deals/${encodeURIComponent(id)}`;
}

export function getPrioritizedDeals(query: PageQuery): Promise<Paginated<PrioritizedDeal>> {
  return apiRequest<Paginated<PrioritizedDeal>>(`/deals/prioritized${pageQuery(query)}`);
}

export function getDeal(id: string): Promise<Deal> {
  return apiRequest<Deal>(dealPath(id));
}

export function getDealNextAction(id: string): Promise<DealNextAction> {
  return apiRequest<DealNextAction>(`${dealPath(id)}/next-action`);
}

function companyPath(id: string): string {
  return `/companies/${encodeURIComponent(id)}`;
}

function contactPath(id: string): string {
  return `/contacts/${encodeURIComponent(id)}`;
}

export function getCompanies(query: PageQuery): Promise<Paginated<Company>> {
  return apiRequest<Paginated<Company>>(`/companies${pageQuery(query)}`);
}

export function getCompany(id: string): Promise<Company> {
  return apiRequest<Company>(companyPath(id));
}

export function createCompany(body: CompanyBody): Promise<Company> {
  return apiRequest<Company>("/companies", { method: "POST", body });
}

export function updateCompany(id: string, body: CompanyBody): Promise<Company> {
  return apiRequest<Company>(companyPath(id), { method: "PATCH", body });
}

export function deleteCompany(id: string): Promise<void> {
  return apiRequest<void>(companyPath(id), { method: "DELETE" });
}

export function getCompanyContacts(
  companyId: string,
  query: PageQuery,
): Promise<Paginated<Contact>> {
  return apiRequest<Paginated<Contact>>(`${companyPath(companyId)}/contacts${pageQuery(query)}`);
}

export function createCompanyContact(companyId: string, body: ContactBody): Promise<Contact> {
  return apiRequest<Contact>(`${companyPath(companyId)}/contacts`, { method: "POST", body });
}

export function updateContact(id: string, body: ContactBody): Promise<Contact> {
  return apiRequest<Contact>(contactPath(id), { method: "PATCH", body });
}

export function deleteContact(id: string): Promise<void> {
  return apiRequest<void>(contactPath(id), { method: "DELETE" });
}

export function getCompanyDeals(companyId: string, query: PageQuery): Promise<Paginated<Deal>> {
  return apiRequest<Paginated<Deal>>(`${companyPath(companyId)}/deals${pageQuery(query)}`);
}

export function createCompanyDeal(companyId: string, body: CreateDealBody): Promise<Deal> {
  return apiRequest<Deal>(`${companyPath(companyId)}/deals`, { method: "POST", body });
}

export function getDealInteractions(
  dealId: string,
  query: PageQuery,
): Promise<Paginated<Interaction>> {
  return apiRequest<Paginated<Interaction>>(`${dealPath(dealId)}/interactions${pageQuery(query)}`);
}

export function createDealInteraction(
  dealId: string,
  body: CreateInteractionBody,
): Promise<Interaction> {
  return apiRequest<Interaction>(`${dealPath(dealId)}/interactions`, { method: "POST", body });
}

export function updateDeal(id: string, body: UpdateDealBody): Promise<Deal> {
  return apiRequest<Deal>(dealPath(id), { method: "PATCH", body });
}

function interactionPath(id: string): string {
  return `/interactions/${encodeURIComponent(id)}`;
}

export function updateInteraction(id: string, body: UpdateInteractionBody): Promise<Interaction> {
  return apiRequest<Interaction>(interactionPath(id), { method: "PATCH", body });
}

export function deleteInteraction(id: string): Promise<void> {
  return apiRequest<void>(interactionPath(id), { method: "DELETE" });
}

export function deleteDeal(id: string): Promise<void> {
  return apiRequest<void>(dealPath(id), { method: "DELETE" });
}

export function askCrm(body: AskBody): Promise<AskResponse> {
  return apiRequest<AskResponse>("/ask", { method: "POST", body });
}
