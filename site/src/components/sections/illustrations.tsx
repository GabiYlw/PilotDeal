import { ArrowDown, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import { Badge, IllustrationPanel } from "@/components/ui/primitives";
import { underTheHood } from "@/content";

// Small pictures of the app's real UI, built in HTML from the same tokens. They show sample data
// that the card text already explains, so the drawings are hidden from screen readers.

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

function SampleDataLabel() {
  return (
    <span className="self-end font-mono text-xs tracking-wider text-muted uppercase">
      {underTheHood.illustrationNote}
    </span>
  );
}

export function ScoresIllustration() {
  const data = underTheHood.scores;
  return (
    <IllustrationPanel aria-hidden="true" className="flex flex-col gap-4">
      <SampleDataLabel />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{data.dealTitle}</span>
        <Badge variant="danger">{data.overdue}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-3.5 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-accent" style={{ width: `${data.score}%` }} />
        </div>
        <span className="w-12 text-right text-2xl font-bold text-foreground tabular-nums">
          {data.score}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {data.factors.map((factor) => (
          <li key={factor.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted">{factor.label}</span>
            <span className="font-mono text-foreground tabular-nums">{factor.points}</span>
          </li>
        ))}
      </ul>
    </IllustrationPanel>
  );
}

export function SourcesIllustration() {
  const data = underTheHood.sources;
  return (
    <IllustrationPanel aria-hidden="true" className="flex flex-col gap-3">
      <SampleDataLabel />
      <p className="w-fit max-w-[85%] rounded-xl border border-card-border bg-surface px-3 py-2 text-sm text-foreground">
        {data.question}
      </p>
      <p className="rounded-xl border border-card-border bg-surface px-3 py-2 text-sm text-foreground">
        {data.answer.map((part, index) =>
          typeof part === "string" ? (
            part
          ) : (
            <span key={index} className="font-medium text-link underline underline-offset-4">
              {part.label}
            </span>
          ),
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {data.sources.map((source) => (
          <span
            key={source.label}
            className="flex items-center gap-2 rounded-xl border border-accent bg-surface px-3 py-2"
          >
            <span className="font-mono text-xs font-semibold text-foreground">{source.label}</span>
            <Badge variant="accent">{source.cited}</Badge>
            <Badge>{source.type}</Badge>
          </span>
        ))}
      </div>
    </IllustrationPanel>
  );
}

export function FallbackIllustration() {
  return (
    <IllustrationPanel aria-hidden="true" className="flex flex-col gap-2">
      {underTheHood.fallback.rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2.5"
        >
          <span className="text-xs text-muted">{row.label}</span>
          <Badge variant={row.tone}>{row.badge}</Badge>
        </div>
      ))}
    </IllustrationPanel>
  );
}

// Real content (not sample data), so it stays readable by screen readers.
export function GuardrailsList() {
  return (
    <IllustrationPanel>
      <ul className="flex flex-col gap-3">
        {underTheHood.guardrails.items.map((item) => (
          <li key={item.title} className="flex gap-3">
            <ShieldCheck {...ICON} className="mt-0.5 size-4 shrink-0 text-link" />
            <span className="text-sm">
              <span className="font-semibold text-foreground">{item.title}.</span>{" "}
              <span className="text-muted">{item.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </IllustrationPanel>
  );
}

export function EmbeddingsIllustration() {
  const { flow } = underTheHood.embeddings;
  return (
    <IllustrationPanel aria-hidden="true" className="flex flex-col items-stretch gap-1.5">
      {flow.map((step, index) => (
        <div key={step.label} className="flex flex-col items-center gap-1.5">
          {index > 0 && <ArrowDown {...ICON} className="size-4 text-muted" />}
          <div className="w-full rounded-lg bg-surface px-3 py-2 text-center">
            <p className="font-mono text-xs font-semibold text-foreground">{step.label}</p>
            <p className="text-xs text-muted">{step.detail}</p>
          </div>
        </div>
      ))}
    </IllustrationPanel>
  );
}

export function AgentsIllustration() {
  const data = underTheHood.agents;
  return (
    <IllustrationPanel aria-hidden="true">
      <ol className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {data.steps.map((step, index) => (
          <li key={step} className="flex flex-col items-center gap-2 sm:flex-1 sm:flex-row">
            <span className="w-full rounded-lg border border-card-border bg-surface px-3 py-2 text-center text-sm font-medium text-foreground">
              <span className="mr-2 font-mono text-xs text-link">0{index + 1}</span>
              {step}
            </span>
            <ArrowRight {...ICON} className="size-4 shrink-0 rotate-90 text-muted sm:rotate-0" />
          </li>
        ))}
        <li className="flex sm:flex-1">
          <span className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            <UserCheck {...ICON} className="size-4" />
            {data.human}
          </span>
        </li>
      </ol>
    </IllustrationPanel>
  );
}
