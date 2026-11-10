// @vitest-environment node
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { editCompany, removeCompany } from "@/app/clients/[id]/actions";
import { addCompany } from "@/app/clients/new/actions";
import { API_UNREACHABLE, ApiError, createCompany, deleteCompany, updateCompany } from "@/lib/api";
import { initialFormState } from "@/lib/form-state";
import {
  API_NOT_RUNNING_MESSAGE,
  COMPANY_NOT_FOUND_MESSAGE,
  DELETE_FAILED_MESSAGE,
  SAVE_FAILED_MESSAGE,
} from "@/lib/messages";
import type { Company } from "@/lib/types";

const REDIRECT = new Error("NEXT_REDIRECT");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw REDIRECT;
  }),
  RedirectType: { replace: "replace", push: "push" },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createCompany: vi.fn(),
  updateCompany: vi.fn(),
  deleteCompany: vi.fn(),
}));

const createMock = vi.mocked(createCompany);
const updateMock = vi.mocked(updateCompany);
const deleteMock = vi.mocked(deleteCompany);
const revalidateMock = vi.mocked(revalidatePath);
const redirectMock = vi.mocked(redirect);

const COMPANY = { id: "new1" } as Company;
const FIELDS = { name: "Acme", industry: "", website: "https://acme.test" };
const NOT_FOUND = new ApiError("gone", 404, "NOT_FOUND");
const WEBSITE_ISSUE = new ApiError("Invalid request body", 400, "VALIDATION_ERROR", [
  { path: ["website"], message: "Enter a valid URL starting with http:// or https://" },
]);

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  revalidateMock.mockReset();
  redirectMock.mockClear();
});

describe("addCompany", () => {
  it("creates the company with empty optional fields as null, revalidates and redirects", async () => {
    createMock.mockResolvedValue(COMPANY);

    await expect(addCompany(initialFormState(), form(FIELDS))).rejects.toBe(REDIRECT);

    expect(createMock).toHaveBeenCalledWith({
      name: "Acme",
      industry: null,
      website: "https://acme.test",
    });
    expect(revalidateMock).toHaveBeenCalledWith("/clients");
    expect(redirectMock).toHaveBeenCalledWith("/clients/new1");
  });

  it("sends whitespace-only optional fields as null", async () => {
    createMock.mockResolvedValue(COMPANY);

    await expect(
      addCompany(initialFormState(), form({ name: "Acme", industry: "  ", website: " " })),
    ).rejects.toBe(REDIRECT);

    expect(createMock).toHaveBeenCalledWith({ name: "Acme", industry: null, website: null });
  });

  it("maps a validation issue to its field and keeps the submitted values", async () => {
    createMock.mockRejectedValue(WEBSITE_ISSUE);

    const result = await addCompany(initialFormState(), form(FIELDS));

    expect(result).toEqual({
      status: "error",
      fieldErrors: { website: "Enter a valid URL starting with http:// or https://" },
      formError: undefined,
      values: FIELDS,
    });
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each([
    ["the API is down", new ApiError("x", 0, API_UNREACHABLE), API_NOT_RUNNING_MESSAGE],
    ["the API fails", new ApiError("x", 500, "INTERNAL"), SAVE_FAILED_MESSAGE],
  ])("returns a form error without redirecting when %s", async (_name, error, message) => {
    createMock.mockRejectedValue(error);

    const result = await addCompany(initialFormState(), form(FIELDS));

    expect(result.formError).toBe(message);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rethrows an error that is not an ApiError", async () => {
    createMock.mockRejectedValue(new TypeError("boom"));

    await expect(addCompany(initialFormState(), form(FIELDS))).rejects.toThrow("boom");
  });
});

describe("editCompany", () => {
  it("sends every field with empty optional fields as null and revalidates", async () => {
    updateMock.mockResolvedValue(COMPANY);

    const result = await editCompany("c1", initialFormState(), form(FIELDS));

    expect(updateMock).toHaveBeenCalledWith("c1", {
      name: "Acme",
      industry: null,
      website: "https://acme.test",
    });
    expect(revalidateMock).toHaveBeenCalledWith("/clients/c1");
    expect(revalidateMock).toHaveBeenCalledWith("/clients");
    expect(result).toEqual({ status: "success", fieldErrors: {} });
  });

  it("maps a validation issue to its field and keeps the submitted values", async () => {
    updateMock.mockRejectedValue(WEBSITE_ISSUE);

    const result = await editCompany("c1", initialFormState(), form(FIELDS));

    expect(result.fieldErrors).toEqual({
      website: "Enter a valid URL starting with http:// or https://",
    });
    expect(result.values).toEqual(FIELDS);
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("explains that the company is gone on a 404 without revalidating", async () => {
    updateMock.mockRejectedValue(NOT_FOUND);

    const result = await editCompany("c1", initialFormState(), form(FIELDS));

    expect(result.formError).toBe(COMPANY_NOT_FOUND_MESSAGE);
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("rethrows an error that is not an ApiError", async () => {
    updateMock.mockRejectedValue(new TypeError("boom"));

    await expect(editCompany("c1", initialFormState(), form(FIELDS))).rejects.toThrow("boom");
  });
});

describe("removeCompany", () => {
  it("deletes, revalidates the companies and deals lists and redirects with replace", async () => {
    deleteMock.mockResolvedValue(undefined);

    await expect(removeCompany("c1")).rejects.toBe(REDIRECT);

    expect(deleteMock).toHaveBeenCalledWith("c1");
    expect(revalidateMock).toHaveBeenCalledWith("/clients");
    expect(revalidateMock).toHaveBeenCalledWith("/deals");
    expect(redirectMock).toHaveBeenCalledWith("/clients?deleted=1", "replace");
  });

  it("redirects to the already-deleted notice on a 404", async () => {
    deleteMock.mockRejectedValue(NOT_FOUND);

    await expect(removeCompany("c1")).rejects.toBe(REDIRECT);

    expect(redirectMock).toHaveBeenCalledWith("/clients?deleted=already", "replace");
  });

  it.each([
    ["the API fails", new ApiError("x", 500, "INTERNAL"), DELETE_FAILED_MESSAGE],
    ["the API is down", new ApiError("x", 0, API_UNREACHABLE), API_NOT_RUNNING_MESSAGE],
  ])("returns an error without redirecting when %s", async (_name, error, message) => {
    deleteMock.mockRejectedValue(error);

    const result = await removeCompany("c1");

    expect(result).toMatchObject({ status: "error", formError: message });
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rethrows an error that is not an ApiError", async () => {
    deleteMock.mockRejectedValue(new TypeError("boom"));

    await expect(removeCompany("c1")).rejects.toThrow("boom");
  });
});
