import { Check } from "lucide-react";
import { Card, Section, SectionHeading } from "@/components/ui/primitives";
import { problem } from "@/content";

const TITLE_ID = "problem-title";

export function Problem() {
  const { highlight } = problem;
  return (
    <Section id={problem.id} labelledBy={TITLE_ID}>
      <div className="grid gap-10 lg:grid-cols-5 lg:gap-16">
        <div className="lg:col-span-2">
          <SectionHeading
            id={TITLE_ID}
            eyebrow={problem.eyebrow}
            title={problem.title}
            intro={problem.intro}
          />
        </div>
        <Card className="lg:col-span-3">
          <ol aria-label={problem.timelineLabel} className="flex flex-col">
            {problem.timeline.map((entry) => (
              <li
                key={entry.time}
                className="flex gap-4 border-b border-border py-4 first:pt-0 sm:gap-6"
              >
                <time dateTime={entry.time} className="w-12 shrink-0 font-mono text-sm text-muted">
                  {entry.time}
                </time>
                <span className="text-sm text-foreground">{entry.text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 flex gap-4 rounded-xl border border-accent bg-accent-subtle p-4 sm:gap-6">
            <time
              dateTime={highlight.time}
              className="w-12 shrink-0 font-mono text-sm font-semibold text-link"
            >
              {highlight.time}
            </time>
            <span className="flex gap-2 text-sm text-foreground">
              <Check
                aria-hidden="true"
                strokeWidth={1.75}
                className="mt-0.5 size-4 shrink-0 text-link"
              />
              <span>
                <strong className="font-semibold">{highlight.label}:</strong> {highlight.text}
              </span>
            </span>
          </p>
        </Card>
      </div>
    </Section>
  );
}
