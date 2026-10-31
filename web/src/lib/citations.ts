export type AnswerSegment = { kind: "text"; text: string } | { kind: "citation"; label: string };

// A well-formed marker: [S1], [S1, S2], [ S1 , S2 ]. Anything else is not a marker.
const MARKER = /\[\s*(S\d+(?:\s*,\s*S\d+)*)\s*\]/g;
const LABEL = /S\d+/g;

function pushText(segments: AnswerSegment[], text: string): void {
  if (text === "") return;
  const last = segments.at(-1);
  if (last?.kind === "text") {
    last.text += text;
  } else {
    segments.push({ kind: "text", text });
  }
}

// Splits one marker so that brackets, commas and whitespace stay text and only known labels
// become citations. Joining the segments always gives back the original string.
function pushMarker(segments: AnswerSegment[], marker: string, known: ReadonlySet<string>): void {
  let cursor = 0;
  for (const match of marker.matchAll(LABEL)) {
    pushText(segments, marker.slice(cursor, match.index));
    if (known.has(match[0])) {
      segments.push({ kind: "citation", label: match[0] });
    } else {
      pushText(segments, match[0]);
    }
    cursor = match.index + match[0].length;
  }
  pushText(segments, marker.slice(cursor));
}

export function parseCitations(answer: string, knownLabels: ReadonlySet<string>): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let cursor = 0;
  for (const match of answer.matchAll(MARKER)) {
    pushText(segments, answer.slice(cursor, match.index));
    pushMarker(segments, match[0], knownLabels);
    cursor = match.index + match[0].length;
  }
  pushText(segments, answer.slice(cursor));
  return segments;
}
