import type { ReactNode } from "react";
import { Badge } from "@/components/ui/primitives";
import { howItWorks } from "@/content";
import { cn } from "@/lib/cn";

// Small, readable pictures of the dashboard's real cards (web/src/components), built in HTML from
// the same tokens, for the "How it works" steps. A screenshot of a whole 1440px page is unreadable
// at this size; these show only the part each step is about, at the app's own text size.
// They hold sample data, so they are hidden from screen readers; the step text and its lettered
// notes (the same letters as the markers here) carry the meaning.

// The lettered marker that ties a spot in a mockup to a note in the step text.
export function Marker({ letter, className }: { letter: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-semibold text-accent-foreground",
        className,
      )}
    >
      {letter}
    </span>
  );
}

// A marker pinned to the top-left corner of the element it labels.
function Pinned({ letter, children }: { letter: string; children: ReactNode }) {
  return (
    <div className="relative">
      <Marker letter={letter} className="absolute -top-3 -left-3 z-10" />
      {children}
    </div>
  );
}

// The canvas the app cards sit on, like a page of the dashboard.
function Stage({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-2xl border border-card-border bg-canvas p-4 sm:p-6"
    >
      <span className="self-end font-mono text-xs tracking-wider text-muted uppercase">
        {howItWorks.sampleNote}
      </span>
      {children}
    </div>
  );
}

// A dashboard card. "highlighted" is the teal border the app gives a cited source.
function AppCard({
  highlighted = false,
  className,
  children,
}: {
  highlighted?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface p-4 shadow-card sm:p-5",
        highlighted ? "border-accent" : "border-card-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return <p className="text-base font-semibold text-foreground">{children}</p>;
}

export function LogMockup() {
  const { log } = howItWorks;
  const [latest, ...older] = log.items;
  return (
    <Stage>
      <p className="text-sm text-muted">
        <span className="font-semibold text-foreground">{log.deal}</span> · {log.client}
      </p>
      <AppCard className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{log.title}</CardTitle>
          <span className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground">
            {log.addLabel}
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {latest && (
            <li className="pb-4">
              <Pinned letter="A">
                <div className="flex flex-col gap-2 rounded-xl border border-accent p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{latest.type}</Badge>
                    <span className="text-xs text-muted">{latest.date}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-sm text-foreground">{latest.notes}</p>
                    <Marker letter="B" />
                  </div>
                </div>
              </Pinned>
            </li>
          )}
          {older.map((item) => (
            <li key={item.date} className="flex flex-col gap-2 px-3 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{item.type}</Badge>
                <span className="text-xs text-muted">{item.date}</span>
              </div>
              <p className="text-sm text-foreground">{item.notes}</p>
            </li>
          ))}
        </ul>
      </AppCard>
    </Stage>
  );
}

export function NextActionMockup() {
  const { nextAction, log } = howItWorks;
  return (
    <Stage>
      <p className="text-sm text-muted">
        <span className="font-semibold text-foreground">{log.deal}</span> · {log.client}
      </p>
      <AppCard className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{nextAction.title}</CardTitle>
          <Badge>{nextAction.scoredBy}</Badge>
          <Marker letter="C" />
          <Badge variant="danger">{nextAction.overdue}</Badge>
        </div>
        <Pinned letter="A">
          <p className="pl-4 text-lg leading-snug font-semibold text-balance text-foreground">
            {nextAction.action}
          </p>
        </Pinned>
        <Pinned letter="B">
          <div className="flex flex-col gap-3 rounded-xl bg-canvas p-4">
            <div className="flex items-center gap-3">
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${nextAction.score}%` }}
                />
              </div>
              <span className="w-10 text-right text-2xl font-bold text-foreground tabular-nums">
                {nextAction.score}
              </span>
            </div>
            <p className="text-sm text-muted">{nextAction.reason}</p>
            <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
              {nextAction.factors.map((factor) => (
                <li key={factor.label} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted">{factor.label}</span>
                  <span className="text-foreground tabular-nums">{factor.points}</span>
                </li>
              ))}
            </ul>
          </div>
        </Pinned>
      </AppCard>
    </Stage>
  );
}

export function AskMockup() {
  const { ask } = howItWorks;
  return (
    <Stage>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">{ask.questionLabel}</span>
        <div className="flex gap-2">
          <span className="flex h-9 min-w-0 flex-1 items-center truncate rounded-lg border border-border bg-background px-3 text-sm text-foreground">
            {ask.question}
          </span>
          <span className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground">
            {ask.button}
          </span>
        </div>
      </div>
      <Pinned letter="A">
        <AppCard className="flex flex-col gap-2">
          <CardTitle>{ask.answerTitle}</CardTitle>
          <p className="text-sm text-foreground">
            {ask.answer.map((part, index) =>
              typeof part === "string" ? (
                part
              ) : (
                <span key={index} className="font-medium text-link underline underline-offset-4">
                  {part.label}
                </span>
              ),
            )}
          </p>
        </AppCard>
      </Pinned>
      <Pinned letter="B">
        <div className="flex flex-col gap-3">
          {ask.sources.map((source) => (
            <AppCard key={source.label} highlighted className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{source.label}</span>
                <Badge variant="accent">{ask.cited}</Badge>
                <Badge>{source.type}</Badge>
                <span className="text-xs text-muted">{source.date}</span>
              </div>
              <p className="text-sm text-muted">
                {source.client} · <span className="text-link">{source.deal}</span>
              </p>
              <p className="text-sm text-foreground">{source.excerpt}</p>
            </AppCard>
          ))}
        </div>
      </Pinned>
    </Stage>
  );
}
