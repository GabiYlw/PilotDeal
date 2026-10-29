import type { Response } from "supertest";

export interface ApiPriority {
  score: number;
  reason: string;
  nextAction: string;
  factors: { name: string; points: number }[];
  scoredBy: string;
}

export interface ApiSource {
  interactionId: string;
  dealId: string;
  dealTitle: string;
  companyName: string;
  type: string;
  occurredAt: string;
  excerpt: string;
  similarity: number;
}

// Superset of every resource the API returns, so tests avoid untyped `any` access.
export interface ApiItem {
  id: string;
  companyId: string;
  dealId: string;
  name: string;
  title: string;
  value: number;
  stage: string;
  expectedCloseDate: string | null;
  closedAt: string | null;
  type: string;
  notes: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  companyName: string;
  deal: ApiItem;
  priority: ApiPriority;
}

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
  title: string;
  value: number;
  stage: string;
  expectedCloseDate: string | null;
  closedAt: string | null;
  dealId: string;
  type: string;
  notes: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  score: number;
  reason: string;
  nextAction: string;
  factors: { name: string; points: number }[];
  scoredBy: string;
  data: ApiItem[];
  meta: { page: number; pageSize: number; total: number };
  answer: string | null;
  answeredBy: string;
  sources: ApiSource[];
  error: { code: string; message: string; details?: unknown };
}

export function bodyOf(response: Response): ApiBody {
  const body: unknown = response.body;
  return body as ApiBody;
}
