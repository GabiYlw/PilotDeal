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
