import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AskAnswer } from "@/components/ask/ask-answer";
import { response, source } from "./ask-fixtures";

const NO_CLEAR = "The notes don't contain a clear answer";
const NO_AI = "No AI answer available. Showing the most relevant notes.";

function precedes(first: HTMLElement, second: HTMLElement): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("AskAnswer", () => {
  it("shows the answer card and the sources without state notices for a normal answer", () => {
    render(<AskAnswer response={response()} />);

    expect(screen.getByText("Answer")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Sources" })).toBeTruthy();
    expect(screen.queryByText(NO_CLEAR)).toBeNull();
    expect(screen.queryByText(NO_AI)).toBeNull();
  });

  // Both sit directly under the page's h1, so neither may skip to h3.
  it("titles the answer and the sources as level-2 headings", () => {
    render(<AskAnswer response={response()} />);

    expect(screen.getByRole("heading", { name: "Answer", level: 2 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sources", level: 2 })).toBeTruthy();
  });

  it("puts the insufficient-information notice before the answer and the sources", () => {
    render(<AskAnswer response={response({ insufficientInformation: true })} />);

    const notice = screen.getByText(NO_CLEAR);
    expect(precedes(notice, screen.getByText("Answer"))).toBe(true);
    expect(precedes(notice, screen.getByRole("list", { name: "Sources" }))).toBe(true);
  });

  it("shows the no-AI notice before the sources and no answer card when nothing was generated", () => {
    render(
      <AskAnswer
        response={response({ answer: null, answeredBy: "none", citedInteractionIds: [] })}
      />,
    );

    expect(precedes(screen.getByText(NO_AI), screen.getByRole("list", { name: "Sources" }))).toBe(
      true,
    );
    expect(screen.queryByText("Answer")).toBeNull();
  });

  it("shows no answer card for an empty llm answer but keeps the insufficient notice", () => {
    render(<AskAnswer response={response({ answer: "", insufficientInformation: true })} />);

    expect(screen.queryByText("Answer")).toBeNull();
    expect(screen.getByText(NO_CLEAR)).toBeTruthy();
  });

  it("shows only the empty state when there are no sources", () => {
    render(
      <AskAnswer
        response={response({ sources: [], answer: "x", insufficientInformation: true })}
      />,
    );

    expect(screen.getByText("No notes matched your question")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText("Answer")).toBeNull();
    expect(screen.queryByText(NO_CLEAR)).toBeNull();
  });

  it("highlights only the sources listed in citedInteractionIds", () => {
    render(
      <AskAnswer
        response={response({
          citedInteractionIds: ["i2", "unknown"],
          sources: [source(), source({ label: "S2", interactionId: "i2" })],
        })}
      />,
    );

    expect(screen.getAllByText("Cited")).toHaveLength(1);
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).not.toContain("Cited");
    expect(items[1].textContent).toContain("Cited");
  });
});
