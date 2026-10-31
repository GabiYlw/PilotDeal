import { SourceCard } from "@/components/ask/source-card";
import type { AskSource } from "@/lib/types";

export function SourceList({
  sources,
  citedIds,
}: {
  sources: AskSource[];
  citedIds: ReadonlySet<string>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground">Sources</h2>
      <ol aria-label="Sources" className="flex flex-col gap-3">
        {sources.map((source) => (
          <li key={source.interactionId}>
            <SourceCard source={source} cited={citedIds.has(source.interactionId)} />
          </li>
        ))}
      </ol>
    </section>
  );
}
