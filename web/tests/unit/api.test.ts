// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_UNREACHABLE,
  ApiError,
  apiRequest,
  createDealInteraction,
  DEAL_CLOSED,
  getCompany,
  getDeal,
  getDealInteractions,
  getDealNextAction,
  getHealth,
  getPrioritizedDeals,
  UNEXPECTED_RESPONSE,
  updateDeal,
} from "@/lib/api";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function rejectionOf(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ApiError)) {
    throw new Error(`Expected an ApiError, got ${String(error)}`);
  }
  return error;
}

beforeEach(() => {
  vi.stubEnv("API_URL", "http://api.test/");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("apiRequest", () => {
  it("returns the parsed body and calls API_URL without a doubled slash", async () => {
    const page = { data: [{ id: "c1" }], meta: { page: 1, pageSize: 20, total: 1 } };
    fetchMock.mockResolvedValue(jsonResponse(200, page));

    const result = await apiRequest("/companies");

    expect(result).toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/companies",
      expect.objectContaining({ method: "GET", body: undefined }),
    );
  });

  it("sends a JSON body with the method", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "c1" }));

    await apiRequest("/companies", { method: "POST", body: { name: "Acme" } });

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"Acme"}',
    });
  });

  it("turns the API error shape into an ApiError with status, code, message and details", async () => {
    const details = [{ path: ["name"], message: "Required" }];
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Invalid body", details } }),
    );

    const error = await rejectionOf(apiRequest("/companies", { method: "POST", body: {} }));

    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid body",
      details,
    });
  });

  it.each([
    ["an HTML page", new Response("<h1>Bad gateway</h1>", { status: 502 })],
    ["an empty body", new Response(null, { status: 502 })],
    ["JSON without the error shape", jsonResponse(502, { message: "upstream" })],
  ])("returns an UNEXPECTED_RESPONSE ApiError when an error status has %s", async (_name, response) => {
    fetchMock.mockResolvedValue(response);

    const error = await rejectionOf(apiRequest("/companies"));

    expect(error).toMatchObject({ status: 502, code: UNEXPECTED_RESPONSE });
  });

  it("returns an API_UNREACHABLE ApiError with status 0 when fetch fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const error = await rejectionOf(apiRequest("/companies"));

    expect(error).toMatchObject({ status: 0, code: API_UNREACHABLE });
    expect(error.message).toContain("http://api.test/companies");
  });

  it("throws a configuration error when API_URL is not set", async () => {
    vi.stubEnv("API_URL", "");

    await expect(apiRequest("/companies")).rejects.toThrow("API_URL is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getHealth", () => {
  it.each([
    [200, { status: "ok", database: "up" }],
    [503, { status: "error", database: "down" }],
  ])("returns the health body for status %i", async (status, body) => {
    fetchMock.mockResolvedValue(jsonResponse(status, body));

    await expect(getHealth()).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/health", expect.anything());
  });

  it("still throws for an error status other than 503", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: { code: "INTERNAL_ERROR", message: "boom" } }));

    const error = await rejectionOf(getHealth());

    expect(error).toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
  });
});

const JSON_HEADERS = { "Content-Type": "application/json" };

describe("deal endpoints", () => {
  it.each<[string, () => Promise<unknown>, string, RequestInit]>([
    [
      "getPrioritizedDeals",
      () => getPrioritizedDeals({ page: 2, pageSize: 20 }),
      "/deals/prioritized?page=2&pageSize=20",
      { method: "GET" },
    ],
    ["getDeal", () => getDeal("d1"), "/deals/d1", { method: "GET" }],
    ["getDealNextAction", () => getDealNextAction("d1"), "/deals/d1/next-action", { method: "GET" }],
    ["getCompany", () => getCompany("c1"), "/companies/c1", { method: "GET" }],
    [
      "getDealInteractions",
      () => getDealInteractions("d1", { page: 1, pageSize: 100 }),
      "/deals/d1/interactions?page=1&pageSize=100",
      { method: "GET" },
    ],
    [
      "createDealInteraction",
      () => createDealInteraction("d1", { type: "CALL", notes: "Hi" }),
      "/deals/d1/interactions",
      { method: "POST", headers: JSON_HEADERS, body: '{"type":"CALL","notes":"Hi"}' },
    ],
    [
      "updateDeal",
      () => updateDeal("d1", { stage: "WON" }),
      "/deals/d1",
      { method: "PATCH", headers: JSON_HEADERS, body: '{"stage":"WON"}' },
    ],
  ])("%s calls the right URL and method and returns the parsed body", async (_name, call, path, init) => {
    const body = { marker: path };
    fetchMock.mockResolvedValue(jsonResponse(200, body));

    await expect(call()).resolves.toEqual(body);

    expect(fetchMock).toHaveBeenCalledWith(`http://api.test${path}`, expect.objectContaining(init));
  });

  it("encodes path ids so they cannot change the route", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await getDeal("a/b?c");

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/deals/a%2Fb%3Fc", expect.anything());
  });

  it.each<[string, () => Promise<unknown>, number, string]>([
    ["getDeal", () => getDeal("d1"), 404, "NOT_FOUND"],
    ["getDealNextAction", () => getDealNextAction("d1"), 409, DEAL_CLOSED],
  ])("%s turns status %i into an ApiError with the API code", async (_name, call, status, code) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error: { code, message: "nope" } }));

    expect(await rejectionOf(call())).toMatchObject({ status, code });
  });

  it("createDealInteraction keeps the validation details of a 400", async () => {
    const details = [{ path: ["notes"], message: "Too small" }];
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Invalid request body", details } }),
    );

    const error = await rejectionOf(createDealInteraction("d1", { type: "NOTE", notes: "" }));

    expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR", details });
  });
});
