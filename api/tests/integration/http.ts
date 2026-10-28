import type { Response } from "supertest";

// Superset of every JSON body the API returns, so tests avoid untyped `any` access.
export interface ApiBody {
  id: string;
  companyId: string;
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
  data: { name: string }[];
  meta: { page: number; pageSize: number; total: number };
  error: { code: string; message: string; details?: unknown };
}

export function bodyOf(response: Response): ApiBody {
  const body: unknown = response.body;
  return body as ApiBody;
}
