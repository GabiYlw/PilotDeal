import { TextLink } from "@/components/ui/text-link";
import { parseCitations } from "@/lib/citations";

// Model output is untrusted: it is only ever rendered as text nodes (React escapes them) and
// links built by us. Never as HTML or Markdown.
export function AnswerText({ answer, labels }: { answer: string; labels: ReadonlySet<string> }) {
  return (
    <p className="text-sm break-words whitespace-pre-line text-foreground">
      {parseCitations(answer, labels).map((segment, index) =>
        segment.kind === "text" ? (
          segment.text
        ) : (
          <TextLink key={index} href={`#source-${segment.label}`}>
            {segment.label}
          </TextLink>
        ),
      )}
    </p>
  );
}
