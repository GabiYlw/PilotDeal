import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { loadCollection, loadResource } from "@/lib/load";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw NOT_FOUND;
  }),
}));

describe("loadResource", () => {
  it("returns the data on success", async () => {
    expect(await loadResource(Promise.resolve(5))).toEqual({ status: "ok", data: 5 });
  });

  it.each<[number, string]>([
    [404, "NOT_FOUND"],
    [400, "VALIDATION_ERROR"],
  ])("calls notFound for status %i %s", async (status, code) => {
    await expect(loadResource(Promise.reject(new ApiError("m", status, code)))).rejects.toBe(
      NOT_FOUND,
    );
  });

  it("reports unreachable for status 0", async () => {
    const result = await loadResource(Promise.reject(new ApiError("m", 0, "API_UNREACHABLE")));
    expect(result).toEqual({ status: "unreachable" });
  });

  it.each<[string, unknown]>([
    ["a 500", new ApiError("m", 500, "INTERNAL")],
    ["a 400 with another code", new ApiError("m", 400, "OTHER")],
    ["a plain error", new Error("config")],
  ])("rethrows %s", async (_n, error) => {
    await expect(loadResource(Promise.reject(error))).rejects.toBe(error);
  });
});

describe("loadCollection", () => {
  it("rethrows a 404 instead of calling notFound", async () => {
    const error = new ApiError("m", 404, "NOT_FOUND");
    await expect(loadCollection(Promise.reject(error))).rejects.toBe(error);
  });

  it("reports unreachable for status 0", async () => {
    const result = await loadCollection(Promise.reject(new ApiError("m", 0, "API_UNREACHABLE")));
    expect(result).toEqual({ status: "unreachable" });
  });
});
