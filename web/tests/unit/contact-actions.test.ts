// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addContact, editContact, removeContact } from "@/app/clients/[id]/actions";
import { ApiError, createCompanyContact, deleteContact, updateContact } from "@/lib/api";
import { initialFormState } from "@/lib/form-state";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  CONTACT_NOT_FOUND_MESSAGE,
  DELETE_FAILED_MESSAGE,
} from "@/lib/messages";
import type { Contact } from "@/lib/types";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  RedirectType: { replace: "replace", push: "push" },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createCompanyContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));

const createMock = vi.mocked(createCompanyContact);
const updateMock = vi.mocked(updateContact);
const deleteMock = vi.mocked(deleteContact);
const revalidateMock = vi.mocked(revalidatePath);

const CONTACT = {} as Contact;
const FIELDS = { name: "Ann", email: "", phone: "  ", role: "CTO" };
const NOT_FOUND = new ApiError("gone", 404, "NOT_FOUND");
const EMAIL_ISSUE = new ApiError("Invalid request body", 400, "VALIDATION_ERROR", [
  { path: ["email"], message: "Enter a valid email address" },
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
});

describe("addContact", () => {
  it("creates the contact with empty optional fields as null and revalidates the company", async () => {
    createMock.mockResolvedValue(CONTACT);

    const result = await addContact("c1", initialFormState(), form(FIELDS));

    expect(createMock).toHaveBeenCalledWith("c1", {
      name: "Ann",
      email: null,
      phone: null,
      role: "CTO",
    });
    expect(revalidateMock).toHaveBeenCalledWith("/clients/c1");
    expect(result).toEqual({ status: "success", fieldErrors: {} });
  });

  it("maps a validation issue to its field and keeps the submitted values", async () => {
    createMock.mockRejectedValue(EMAIL_ISSUE);

    const result = await addContact("c1", initialFormState(), form(FIELDS));

    expect(result.fieldErrors).toEqual({ email: "Enter a valid email address" });
    expect(result.values).toEqual(FIELDS);
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("explains that the company is gone on a 404 without revalidating", async () => {
    createMock.mockRejectedValue(NOT_FOUND);

    const result = await addContact("c1", initialFormState(), form(FIELDS));

    expect(result.formError).toBe(COMPANY_NOT_FOUND_MESSAGE);
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("rethrows an error that is not an ApiError", async () => {
    createMock.mockRejectedValue(new TypeError("boom"));

    await expect(addContact("c1", initialFormState(), form(FIELDS))).rejects.toThrow("boom");
  });
});

describe("editContact", () => {
  it("updates the contact by its own id and revalidates the company", async () => {
    updateMock.mockResolvedValue(CONTACT);

    const result = await editContact("c1", "p1", initialFormState(), form(FIELDS));

    expect(updateMock).toHaveBeenCalledWith("p1", {
      name: "Ann",
      email: null,
      phone: null,
      role: "CTO",
    });
    expect(revalidateMock).toHaveBeenCalledWith("/clients/c1");
    expect(result).toEqual({ status: "success", fieldErrors: {} });
  });

  it("maps a validation issue to its field and keeps the submitted values", async () => {
    updateMock.mockRejectedValue(EMAIL_ISSUE);

    const result = await editContact("c1", "p1", initialFormState(), form(FIELDS));

    expect(result.fieldErrors).toEqual({ email: "Enter a valid email address" });
    expect(result.values).toEqual(FIELDS);
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("explains that the contact is gone on a 404 without revalidating", async () => {
    updateMock.mockRejectedValue(NOT_FOUND);

    const result = await editContact("c1", "p1", initialFormState(), form(FIELDS));

    expect(result.formError).toBe(CONTACT_NOT_FOUND_MESSAGE);
    expect(revalidateMock).not.toHaveBeenCalled();
  });
});

describe("removeContact", () => {
  it("deletes the contact and revalidates the company", async () => {
    deleteMock.mockResolvedValue(undefined);

    const result = await removeContact("c1", "p1");

    expect(deleteMock).toHaveBeenCalledWith("p1");
    expect(revalidateMock).toHaveBeenCalledWith("/clients/c1");
    expect(result.status).toBe("success");
  });

  it.each([
    ["a 404", NOT_FOUND, CONTACT_NOT_FOUND_MESSAGE],
    ["a 500", new ApiError("x", 500, "INTERNAL"), DELETE_FAILED_MESSAGE],
  ])("returns an error without revalidating on %s", async (_name, error, message) => {
    deleteMock.mockRejectedValue(error);

    const result = await removeContact("c1", "p1");

    expect(result).toMatchObject({ status: "error", formError: message });
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("rethrows an error that is not an ApiError", async () => {
    deleteMock.mockRejectedValue(new TypeError("boom"));

    await expect(removeContact("c1", "p1")).rejects.toThrow("boom");
  });
});
