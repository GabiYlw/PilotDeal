import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "@/components/ui/pagination";
import { parsePageParam } from "@/lib/pagination";

describe("parsePageParam", () => {
  it.each<[string, string | string[] | undefined]>([
    ["undefined", undefined],
    ["an empty string", ""],
    ["zero", "0"],
    ["a negative number", "-1"],
    ["text", "abc"],
    ["a decimal", "1.5"],
    ["an array", ["2", "3"]],
    ["a huge number", "1000000"],
  ])("returns page 1 for %s", (_name, value) => {
    expect(parsePageParam(value)).toBe(1);
  });

  it("returns the page number for a valid value", () => {
    expect(parsePageParam("2")).toBe(2);
  });
});

describe("Pagination", () => {
  it("disables Previous and links Next on the first of several pages", () => {
    render(<Pagination page={1} pageSize={20} total={50} basePath="/deals" />);

    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/deals?page=2");
    expect(screen.getByText("Showing 1-20 of 50")).toBeTruthy();
  });

  it("disables Next and links Previous on the last page", () => {
    render(<Pagination page={3} pageSize={20} total={50} basePath="/deals" />);

    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href")).toBe(
      "/deals?page=2",
    );
    expect(screen.getByText("Showing 41-50 of 50")).toBeTruthy();
  });

  it("renders nothing when everything fits on the first page", () => {
    const { container } = render(
      <Pagination page={1} pageSize={20} total={20} basePath="/deals" />,
    );

    expect(container.innerHTML).toBe("");
  });
});
