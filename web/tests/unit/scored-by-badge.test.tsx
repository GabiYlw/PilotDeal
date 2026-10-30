import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoredByBadge } from "@/components/deals/scored-by-badge";
import type { ScoredBy } from "@/lib/types";

describe("ScoredByBadge", () => {
  it.each<[ScoredBy, string]>([
    ["rules", "Scored by rules"],
    ["llm", "Scored by AI"],
  ])("shows the text for %s", (scoredBy, text) => {
    render(<ScoredByBadge scoredBy={scoredBy} />);

    expect(screen.getByText(text)).toBeTruthy();
  });
});
