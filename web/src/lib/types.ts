// Response shapes of the PilotDeal API. Keep them in sync with api/src
// (shared/pagination.ts, shared/error-middleware.ts and each module's schemas).

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

// GET /health answers 200 when the database is up and 503 when it is down,
// with this body in both cases.
export interface HealthStatus {
  status: "ok" | "error";
  database: "up" | "down";
}

export const DEAL_STAGES = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const INTERACTION_TYPES = ["EMAIL", "CALL", "MEETING", "NOTE"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export interface Deal {
  id: string;
  companyId: string;
  title: string;
  value: number;
  stage: DealStage;
  /** YYYY-MM-DD */
  expectedCloseDate: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealWithCompany extends Deal {
  companyName: string;
}

export type PriorityFactorName =
  | "daysSinceContact"
  | "closeDate"
  | "closeDatePassed"
  | "stage"
  | "value"
  | "AI adjustment from interaction notes";

export interface PriorityFactor {
  name: PriorityFactorName;
  points: number;
}

export type ScoredBy = "rules" | "llm";

export interface PriorityResult {
  score: number;
  reason: string;
  nextAction: string;
  factors: PriorityFactor[];
  scoredBy: ScoredBy;
}

export interface PrioritizedDeal {
  deal: DealWithCompany;
  priority: PriorityResult;
}

export type DealNextAction = { dealId: string } & PriorityResult;

export interface Interaction {
  id: string;
  dealId: string;
  type: InteractionType;
  notes: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

// Request bodies carry raw form strings: the API validates them.
export interface CreateInteractionBody {
  type: string;
  notes: string;
  occurredAt?: string;
}

export interface UpdateDealBody {
  stage: string;
}

export interface PageQuery {
  page: number;
  pageSize: number;
}
