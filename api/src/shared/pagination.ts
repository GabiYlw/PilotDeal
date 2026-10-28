import { z } from "zod";

function positiveIntString(max: number) {
  return z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max));
}

// Not strict on purpose: unknown query parameters are ignored.
export const paginationQuerySchema = z.object({
  page: positiveIntString(1_000_000).default(1),
  pageSize: positiveIntString(100).default(20),
});

export type Pagination = z.output<typeof paginationQuerySchema>;

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

// What repositories return; services turn it into Paginated<T>.
export interface PageResult<T> {
  items: T[];
  total: number;
}

export function toSkipTake({ page, pageSize }: Pagination): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function toPaginated<T>(result: PageResult<T>, { page, pageSize }: Pagination): Paginated<T> {
  return { data: result.items, meta: { page, pageSize, total: result.total } };
}
