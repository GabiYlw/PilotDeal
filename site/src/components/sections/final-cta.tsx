import { ButtonLink } from "@/components/ui/button-link";
import { Card, Section } from "@/components/ui/primitives";
import { finalCta } from "@/content";

const TITLE_ID = "final-cta-title";

export function FinalCta() {
  return (
    <Section labelledBy={TITLE_ID}>
      <Card className="flex flex-col items-center gap-6 px-6 py-12 text-center sm:py-16">
        <h2 id={TITLE_ID} className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {finalCta.title}
        </h2>
        <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <ButtonLink link={finalCta.primary} icon="arrow" />
          <ButtonLink link={finalCta.secondary} variant="secondary" icon="external" />
        </div>
      </Card>
    </Section>
  );
}
