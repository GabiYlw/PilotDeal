import type { ReactNode } from "react";
import { Card, Section, SectionHeading } from "@/components/ui/primitives";
import { underTheHood } from "@/content";
import { cn } from "@/lib/cn";
import {
  AgentsIllustration,
  EmbeddingsIllustration,
  FallbackIllustration,
  GuardrailsList,
  ScoresIllustration,
  SourcesIllustration,
} from "./illustrations";

const TITLE_ID = "under-the-hood-title";

function BentoCard({
  title,
  text,
  illustration,
  className,
}: {
  title: string;
  text: string;
  illustration: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-5", className)}>
      {illustration}
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted">{text}</p>
      </div>
    </Card>
  );
}

// md: two columns; lg: three. Spans keep every row full at both widths.
export function UnderTheHood() {
  const { scores, sources, fallback, guardrails, embeddings, agents, stack } = underTheHood;
  return (
    <Section id={underTheHood.id} labelledBy={TITLE_ID}>
      <SectionHeading id={TITLE_ID} eyebrow={underTheHood.eyebrow} title={underTheHood.title} />
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BentoCard title={scores.title} text={scores.text} illustration={<ScoresIllustration />} />
        <BentoCard
          title={sources.title}
          text={sources.text}
          illustration={<SourcesIllustration />}
          className="lg:col-span-2"
        />
        <BentoCard
          title={fallback.title}
          text={fallback.text}
          illustration={<FallbackIllustration />}
        />
        <BentoCard
          title={guardrails.title}
          text={guardrails.text}
          illustration={<GuardrailsList />}
        />
        <BentoCard
          title={embeddings.title}
          text={embeddings.text}
          illustration={<EmbeddingsIllustration />}
          className="md:col-span-2 lg:col-span-1"
        />
        <BentoCard
          title={agents.title}
          text={agents.text}
          illustration={<AgentsIllustration />}
          className="md:col-span-2 lg:col-span-3"
        />
      </div>
      <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
        <span className="font-mono text-xs font-semibold tracking-wider uppercase">
          {stack.label}
        </span>
        <span className="sr-only">: </span>
        {stack.items.map((item, index) => (
          <span key={item} className="flex items-center gap-3">
            {index > 0 && <span aria-hidden="true">·</span>}
            <span className="text-foreground">{item}</span>
          </span>
        ))}
      </p>
    </Section>
  );
}
