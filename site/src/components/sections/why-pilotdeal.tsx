import type { ReactNode } from "react";
import { Card, Section, SectionHeading } from "@/components/ui/primitives";
import { whyPilotDeal } from "@/content";
import { cn } from "@/lib/cn";
import {
  FallbackIllustration,
  GuardrailsList,
  PrivacyIllustration,
  ScoresIllustration,
  SourcesIllustration,
} from "./illustrations";

const TITLE_ID = "why-pilotdeal-title";

function BenefitCard({
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
export function WhyPilotDeal() {
  const { scores, sources, fallback, guardrails, privacy } = whyPilotDeal;
  return (
    <Section id={whyPilotDeal.id} labelledBy={TITLE_ID}>
      <SectionHeading id={TITLE_ID} eyebrow={whyPilotDeal.eyebrow} title={whyPilotDeal.title} />
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BenefitCard
          title={scores.title}
          text={scores.text}
          illustration={<ScoresIllustration />}
        />
        <BenefitCard
          title={sources.title}
          text={sources.text}
          illustration={<SourcesIllustration />}
          className="lg:col-span-2"
        />
        <BenefitCard
          title={fallback.title}
          text={fallback.text}
          illustration={<FallbackIllustration />}
        />
        <BenefitCard
          title={guardrails.title}
          text={guardrails.text}
          illustration={<GuardrailsList />}
        />
        <BenefitCard
          title={privacy.title}
          text={privacy.text}
          illustration={<PrivacyIllustration />}
          className="md:col-span-2 lg:col-span-1"
        />
      </div>
    </Section>
  );
}
