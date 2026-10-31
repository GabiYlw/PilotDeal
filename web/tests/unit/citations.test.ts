import { describe, expect, it } from "vitest";
import { type AnswerSegment, parseCitations } from "@/lib/citations";

const text = (value: string): AnswerSegment => ({ kind: "text", text: value });
const cite = (label: string): AnswerSegment => ({ kind: "citation", label });
const KNOWN = new Set(["S1", "S2", "S3"]);

describe("parseCitations", () => {
  it.each<[string, string, AnswerSegment[]]>([
    ["a single marker", "A [S1] b", [text("A ["), cite("S1"), text("] b")]],
    ["a group", "[S1, S2]", [text("["), cite("S1"), text(", "), cite("S2"), text("]")]],
    [
      "a group without spaces",
      "[S1,S2]",
      [text("["), cite("S1"), text(","), cite("S2"), text("]")],
    ],
    [
      "a group with extra spaces",
      "[ S1 , S2 ]",
      [text("[ "), cite("S1"), text(" , "), cite("S2"), text(" ]")],
    ],
    ["adjacent markers", "[S1][S3]", [text("["), cite("S1"), text("]["), cite("S3"), text("]")]],
    ["an unknown label", "see [S9]", [text("see [S9]")]],
    ["a mixed group", "[S1, S9]", [text("["), cite("S1"), text(", S9]")]],
    ["a lower-case label", "[s1]", [text("[s1]")]],
    ["a marker with words", "[S1 and S2]", [text("[S1 and S2]")]],
    ["empty brackets", "[]", [text("[]")]],
    ["a label without digits", "[S]", [text("[S]")]],
    ["no markers", "No markers here", [text("No markers here")]],
    ["an empty answer", "", []],
  ])("handles %s", (_name, answer, expected) => {
    expect(parseCitations(answer, KNOWN)).toEqual(expected);
  });

  it.each(["A [S1] b", "[S1, S2][S9] and [x] [ S3 ,S1 ]", "<b>[S2]</b>\n[S1]", "[S1 and S2]"])(
    "gives back the original text when the segments are joined: %s",
    (answer) => {
      const joined = parseCitations(answer, KNOWN)
        .map((segment) => (segment.kind === "text" ? segment.text : segment.label))
        .join("");
      expect(joined).toBe(answer);
    },
  );
});
