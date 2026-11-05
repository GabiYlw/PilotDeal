import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AskResults } from "@/components/ask/ask-results";
import { API_UNREACHABLE, ApiError, askCrm, EMBEDDING_UNAVAILABLE } from "@/lib/api";
import { response } from "./ask-fixtures";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  askCrm: vi.fn(),
}));
// next/form needs the app router, which does not exist in unit tests.
vi.mock("next/form", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <form {...props}>{children}</form>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(askCrm).mockResolvedValue(response());
});

async function renderResults(dealId: string | null = null, question = "What about price?") {
  render(await AskResults({ question, dealId }));
}

describe("AskResults", () => {
  it("searches without a dealId key when unscoped and shows the answer under the form", async () => {
    await renderResults();

    expect(askCrm).toHaveBeenCalledWith({ question: "What about price?" });
    expect(vi.mocked(askCrm).mock.calls[0][0]).not.toHaveProperty("dealId");
    expect((screen.getByRole("textbox", { name: "Question" }) as HTMLInputElement).value).toBe(
      "What about price?",
    );
    expect(screen.getByText("Answer")).toBeTruthy();
  });

  it("sends the dealId and keeps it in the form when scoped", async () => {
    await renderResults("d1");

    expect(askCrm).toHaveBeenCalledWith({ question: "What about price?", dealId: "d1" });
    expect(document.querySelector('input[type="hidden"][name="dealId"]')).toHaveProperty(
      "value",
      "d1",
    );
  });

  it("shows an API validation message next to the question field", async () => {
    const details = [{ path: ["question"], message: "Question must be at least 3 characters" }];
    vi.mocked(askCrm).mockRejectedValue(new ApiError("x", 400, "VALIDATION_ERROR", details));
    await renderResults(null, "a");

    const input = screen.getByRole("textbox", { name: "Question" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("ask-question-error");
    expect(document.getElementById("ask-question-error")?.textContent).toBe(
      "Question must be at least 3 characters",
    );
    expect(screen.queryByText("Answer")).toBeNull();
  });

  it("shows other validation messages as a form-level alert", async () => {
    const details = [{ path: ["dealId"], message: "dealId must be a valid UUID" }];
    vi.mocked(askCrm).mockRejectedValue(new ApiError("x", 400, "VALIDATION_ERROR", details));
    await renderResults();

    expect(screen.getByRole("alert").textContent).toBe("dealId must be a valid UUID");
  });

  it.each<[string, ApiError, string]>([
    [
      "the embedding model is not ready",
      new ApiError("x", 503, EMBEDDING_UNAVAILABLE),
      "Search is starting up, try again in a moment",
    ],
    [
      "the scope deal was deleted",
      new ApiError("x", 404, "NOT_FOUND"),
      "This deal no longer exists.",
    ],
  ])("shows an alert and keeps the form when %s", async (_name, error, message) => {
    vi.mocked(askCrm).mockRejectedValue(error);
    await renderResults();

    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(screen.getByRole("textbox", { name: "Question" })).toBeTruthy();
  });

  it("shows the unreachable hint and keeps the form when the API does not answer", async () => {
    vi.mocked(askCrm).mockRejectedValue(new ApiError("x", 0, API_UNREACHABLE));
    await renderResults();

    expect(screen.getByText("Cannot reach the API")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Question" })).toBeTruthy();
  });

  // Which errors runAsk rethrows is covered in ask.test.ts; this checks they reach the boundary.
  it("rethrows an unexpected API error for the error boundary", async () => {
    const error = new ApiError("x", 500, "INTERNAL");
    vi.mocked(askCrm).mockRejectedValue(error);

    await expect(AskResults({ question: "abc", dealId: null })).rejects.toBe(error);
  });
});
