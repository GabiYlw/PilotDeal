import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AskView } from "@/components/ask/ask-view";
import { API_UNREACHABLE, ApiError, askCrm, getDeal } from "@/lib/api";
import type { Deal } from "@/lib/types";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getDeal: vi.fn(),
  askCrm: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
// next/form needs the app router, which does not exist in unit tests.
vi.mock("next/form", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <form {...props}>{children}</form>
  ),
}));
// The results fetch request-time data; the view's job is to pass them the question and scope.
vi.mock("@/components/ask/ask-results", () => ({
  AskResults: ({ question, dealId }: { question: string; dealId: string | null }) => (
    <p>{`results for [${question}] in ${dealId ?? "all deals"}`}</p>
  ),
}));

const deal = { id: "d1", title: "Big deal" } as Deal;
const EXAMPLES = [
  "Which customers are worried about price or budget?",
  "Is a competitor involved in any deal?",
  "Which deals are waiting on a contract?",
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getDeal).mockResolvedValue(deal);
});

async function renderView(params: Record<string, string | string[] | undefined>) {
  render(await AskView({ searchParams: Promise.resolve(params) }));
}

function href(name: string): string | null {
  return screen.getByRole("link", { name }).getAttribute("href");
}

describe("AskView", () => {
  it("shows the empty form and the example links when there is no question", async () => {
    await renderView({});

    expect(screen.getByRole("form", { name: "Ask your CRM" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Question" }) as HTMLInputElement).name).toBe("q");
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Try asking", level: 2 })).toBeTruthy();
    for (const question of EXAMPLES) {
      expect(href(question)).toBe(`/ask?${new URLSearchParams({ q: question }).toString()}`);
    }
    expect(askCrm).not.toHaveBeenCalled();
    expect(getDeal).not.toHaveBeenCalled();
  });

  it("keeps a valid scope in the examples and the hidden field", async () => {
    await renderView({ dealId: "d1" });

    expect(getDeal).toHaveBeenCalledWith("d1");
    expect(screen.getByText("Scoped to: Big deal")).toBeTruthy();
    expect(href("Clear scope")).toBe("/ask");
    expect(href(EXAMPLES[1])).toBe(
      `/ask?${new URLSearchParams({ q: EXAMPLES[1], dealId: "d1" }).toString()}`,
    );
    expect(document.querySelector('input[type="hidden"][name="dealId"]')).toHaveProperty(
      "value",
      "d1",
    );
  });

  it("passes the question and scope to the results and keeps the question in the clear link", async () => {
    await renderView({ q: "price & budget?", dealId: "d1" });

    expect(screen.getByText("results for [price & budget?] in d1")).toBeTruthy();
    expect(href("Clear scope")).toBe(`/ask?${new URLSearchParams({ q: "price & budget?" })}`);
    expect(screen.queryByText(EXAMPLES[0])).toBeNull();
  });

  it("uses the first value of repeated params", async () => {
    await renderView({ q: ["first", "second"], dealId: ["d1", "d2"] });

    expect(getDeal).toHaveBeenCalledWith("d1");
    expect(screen.getByText("results for [first] in d1")).toBeTruthy();
  });

  it("sends an empty question to the results so the API can explain it", async () => {
    await renderView({ q: "" });

    expect(screen.getByText("results for [] in all deals")).toBeTruthy();
  });

  it("treats an empty dealId as no scope", async () => {
    await renderView({ q: "abc", dealId: "" });

    expect(getDeal).not.toHaveBeenCalled();
    expect(screen.getByText("results for [abc] in all deals")).toBeTruthy();
    expect(screen.queryByText(/Scoped to/)).toBeNull();
  });

  it.each([
    ["is not found", new ApiError("x", 404, "NOT_FOUND")],
    ["is not a valid id", new ApiError("x", 400, "VALIDATION_ERROR")],
  ])("shows only the notice and a clear link when the scope deal %s", async (_name, error) => {
    vi.mocked(getDeal).mockRejectedValue(error);
    await renderView({ q: "abc", dealId: "nope" });

    expect(screen.getByText("This deal no longer exists.")).toBeTruthy();
    expect(href("Clear scope")).toBe("/ask?q=abc");
    expect(screen.queryByRole("textbox", { name: "Question" })).toBeNull();
    expect(screen.queryByText(EXAMPLES[0])).toBeNull();
    expect(screen.queryByText(/results for/)).toBeNull();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("links the clear link to /ask when there is no question", async () => {
    vi.mocked(getDeal).mockRejectedValue(new ApiError("x", 404, "NOT_FOUND"));
    await renderView({ dealId: "nope" });

    expect(href("Clear scope")).toBe("/ask");
  });

  it("shows the unreachable hint and no results when the scope lookup cannot reach the API", async () => {
    vi.mocked(getDeal).mockRejectedValue(new ApiError("x", 0, API_UNREACHABLE));
    await renderView({ q: "abc", dealId: "d1" });

    expect(screen.getByText("Cannot reach the API")).toBeTruthy();
    expect(screen.queryByText(/results for/)).toBeNull();
  });
});
