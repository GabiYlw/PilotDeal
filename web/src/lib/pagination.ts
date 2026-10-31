export const DEALS_PAGE_SIZE = 20;
export const COMPANIES_PAGE_SIZE = 20;

const PAGE_PARAM = /^[1-9]\d{0,5}$/;

// Anything the API would reject (or an array from a repeated ?page=) falls back to page 1.
export function parsePageParam(value: string | string[] | undefined): number {
  return typeof value === "string" && PAGE_PARAM.test(value) ? Number(value) : 1;
}
