import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceCard } from "@/components/ask/source-card";
import { formatDate } from "@/lib/format";
import { source } from "./ask-fixtures";

function renderCard(cited: boolean, overrides = {}) {
  const { container } = render(<SourceCard source={source(overrides)} cited={cited} />);
  return container.firstElementChild as HTMLElement;
}

describe("SourceCard", () => {
  it("shows the label, company, deal link, type, date and excerpt", () => {
    const card = renderCard(false);

    expect(card.id).toBe("source-S1");
    expect(screen.getByText("S1")).toBeTruthy();
    expect(screen.getByText(/Acme Corp/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Big deal" }).getAttribute("href")).toBe("/deals/d1");
    expect(screen.getByText("Email")).toBeTruthy();
    const time = screen.getByText(formatDate("2026-03-05T10:00:00.000Z"));
    expect(time.getAttribute("datetime")).toBe("2026-03-05T10:00:00.000Z");
    expect(screen.getByText("They think the price is too high.")).toBeTruthy();
  });

  it("marks a cited source with a Cited badge and an accent border", () => {
    const card = renderCard(true);

    expect(screen.getByText("Cited")).toBeTruthy();
    expect(card.className).toContain("border-accent");
  });

  it("shows no badge and a plain border for a source that is not cited", () => {
    const card = renderCard(false);

    expect(screen.queryByText("Cited")).toBeNull();
    expect(card.className).toContain("border-card-border");
    expect(card.className).not.toContain("border-accent");
  });

  // The similarity bands are covered by relevanceLevel in ask-display.test.ts; this checks the wiring.
  it("shows relevance as a level and never prints a percentage", () => {
    const card = renderCard(false, { similarity: 0.35 });

    expect(screen.getByText("Relevance: Medium")).toBeTruthy();
    expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toBe("Medium");
    expect(card.textContent).not.toContain("%");
    expect(card.textContent).not.toContain("0.35");
  });
});
