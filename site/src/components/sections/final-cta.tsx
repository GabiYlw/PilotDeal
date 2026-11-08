import { ButtonLink } from "@/components/ui/button-link";
import { Card, DemoNote, Section } from "@/components/ui/primitives";
import { finalCta } from "@/content";

const TITLE_ID = "final-cta-title";

export function FinalCta() {
  return (
    <Section labelledBy={TITLE_ID}>
      <Card className="flex flex-col items-center gap-6 px-6 py-12 text-center sm:py-16">
        <h2 id={TITLE_ID} className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {finalCta.title}
        </h2>
        <div className="flex w-full flex-col items-center gap-3">
          <ButtonLink link={finalCta.primary} icon="arrow" className="w-full sm:w-auto" />
          <DemoNote>{finalCta.demoNote}</DemoNote>
        </div>
      </Card>
    </Section>
  );
}
