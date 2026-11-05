// @vitest-environment node
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDeal } from "@/app/companies/[id]/actions";
import { editDeal } from "@/app/deals/[id]/actions";
import { ApiError, createCompanyDeal, updateDeal } from "@/lib/api";
import { initialFormState } from "@/lib/form-state";
import { COMPANY_NOT_FOUND_MESSAGE, DEAL_NOT_FOUND_MESSAGE } from "@/lib/messages";
import type { Deal } from "@/lib/types";

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
  createCompanyDeal: vi.fn(),
  updateDeal: vi.fn(),
}));

const createMock = vi.mocked(createCompanyDeal);
const updateMock = vi.mocked(updateDeal);
const revalidateMock = vi.mocked(revalidatePath);
const redirectMock = vi.mocked(redirect);

const DEAL = { id: "d9" } as Deal;
const NOT_FOUND = new ApiError("gone", 404, "NOT_FOUND");
const TITLE_ISSUE = new ApiError("Invalid request body", 400, "VALIDATION_ERROR", [
  { path: ["title"], message: "Title is required" },
]);
const CREATE_FIELDS = { title: "Big", value: "1500.50", stage: "LEAD", expectedCloseDate: "" };
const EDIT_FIELDS = { title: "New", value: "10", expectedCloseDate: "" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  revalidateMock.mockReset();
  redirectMock.mockClear();
});

describe("addDeal", () => {
  it("creates the deal without an empty date, revalidates and redirects to it", async () => {
    createMock.mockResolvedValue(DEAL);

    await expect(addDeal("c1", initialFormState(), form(CREATE_FIELDS))).rejects.toBe(REDIRECT);

    const [companyId, body] = createMock.mock.calls[0];
    expect(companyId).toBe("c1");
    expect(body).toEqual({ title: "Big", value: 1500.5, stage: "LEAD" });
    expect("expectedCloseDate" in body).toBe(false);
    expect(revalidateMock).toHaveBeenCalledWith("/companies/c1");
    expect(revalidateMock).toHaveBeenCalledWith("/deals");
    expect(redirectMock).toHaveBeenCalledWith("/deals/d9");
  });

  it("sends a given date unchanged", async () => {
    createMock.mockResolvedValue(DEAL);

    await expect(
      addDeal(
        "c1",
        initialFormState(),
        form({ ...CREATE_FIELDS, expectedCloseDate: "2026-12-01" }),
      ),
    ).rejects.toBe(REDIRECT);

    expect(createMock.mock.calls[0][1].expectedCloseDate).toBe("2026-12-01");
  });

  it.each<[string, string, number | string | undefined]>([
    ["omits an empty value", "", undefined],
    ["converts a numeric value", "42", 42],
    ["passes a non-numeric value on for the API to report", "abc", "abc"],
  ])("%s", async (_name, raw, expected) => {
    createMock.mockResolvedValue(DEAL);

    await expect(
      addDeal("c1", initialFormState(), form({ ...CREATE_FIELDS, value: raw })),
    ).rejects.toBe(REDIRECT);

    const body = createMock.mock.calls[0][1];
    expect("value" in body).toBe(expected !== undefined);
    expect(body.value).toBe(expected);
  });

  it("maps a validation issue to its field and keeps the submitted values", async () => {
    createMock.mockRejectedValue(TITLE_ISSUE);

    const result = await addDeal("c1", initialFormState(), form(CREATE_FIELDS));

    expect(result.fieldErrors).toEqual({ title: "Title is required" });
    expect(result.values).toEqual(CREATE_FIELDS);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns a form error without redirecting on a 404", async () => {
    createMock.mockRejectedValue(NOT_FOUND);

    const result = await addDeal("c1", initialFormState(), form(CREATE_FIELDS));

    expect(result.formError).toBe(COMPANY_NOT_FOUND_MESSAGE);
    expect(revalidateMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rethrows an error that is not an ApiError", async () => {
    createMock.mockRejectedValue(new TypeError("boom"));

    await expect(addDeal("c1", initialFormState(), form(CREATE_FIELDS))).rejects.toThrow("boom");
  });
});

describe("editDeal", () => {
  it("clears an empty date with null, never sends the stage, and revalidates", async () => {
    updateMock.mockResolvedValue(DEAL);

    const result = await editDeal("d1", "c1", initialFormState(), form(EDIT_FIELDS));

    expect(updateMock).toHaveBeenCalledWith("d1", {
      title: "New",
      value: 10,
      expectedCloseDate: null,
    });
    expect("stage" in updateMock.mock.calls[0][1]).toBe(false);
    expect(revalidateMock).toHaveBeenCalledWith("/deals/d1");
    expect(revalidateMock).toHaveBeenCalledWith("/deals");
    expect(revalidateMock).toHaveBeenCalledWith("/companies/c1");
    expect(result).toEqual({ status: "success", fieldErrors: {} });
  });

  it("sends a given date unchanged", async () => {
    updateMock.mockResolvedValue(DEAL);

    await editDeal(
      "d1",
      "c1",
      initialFormState(),
      form({ ...EDIT_FIELDS, expectedCloseDate: "2026-12-01" }),
    );

    expect(updateMock.mock.calls[0][1].expectedCloseDate).toBe("2026-12-01");
  });

  it("passes a non-numeric value on for the API to report", async () => {
    updateMock.mockResolvedValue(DEAL);

    await editDeal("d1", "c1", initialFormState(), form({ ...EDIT_FIELDS, value: "abc" }));

    expect(updateMock.mock.calls[0][1].value).toBe("abc");
  });

  it("maps a validation issue to its field and keeps the submitted values", async () => {
    updateMock.mockRejectedValue(TITLE_ISSUE);

    const result = await editDeal("d1", "c1", initialFormState(), form(EDIT_FIELDS));

    expect(result.fieldErrors).toEqual({ title: "Title is required" });
    expect(result.values).toEqual(EDIT_FIELDS);
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("explains that the deal is gone on a 404 without revalidating", async () => {
    updateMock.mockRejectedValue(NOT_FOUND);

    const result = await editDeal("d1", "c1", initialFormState(), form(EDIT_FIELDS));

    expect(result.formError).toBe(DEAL_NOT_FOUND_MESSAGE);
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("rethrows an error that is not an ApiError", async () => {
    updateMock.mockRejectedValue(new TypeError("boom"));

    await expect(editDeal("d1", "c1", initialFormState(), form(EDIT_FIELDS))).rejects.toThrow(
      "boom",
    );
  });
});
