import { ButtonLink, UnavailableButton } from "@/components/ui/button-link";
import { FlightWave } from "@/components/ui/flight-path";
import { DemoNote, Section } from "@/components/ui/primitives";
import { finalCta } from "@/content";

const TITLE_ID = "final-cta-title";

// The closing band: a full-width teal tint (light in light, deep teal in dark). A dashed wave
// crosses the top padding from edge to edge, above the title, so it never crosses the text or the
// buttons.
export function FinalCta() {
  return (
    <Section labelledBy={TITLE_ID} className="relative isolate overflow-hidden bg-accent-subtle">
      <FlightWave className="absolute inset-x-0 top-5 -z-10 h-12 sm:top-6 sm:h-16" />
      <div className="flex flex-col items-center gap-6 pt-4 text-center sm:pt-6">
        <h2
          id={TITLE_ID}
          className="text-4xl font-bold tracking-tight text-balance text-foreground sm:text-5xl"
        >
          {finalCta.title}
        </h2>
        <p className="max-w-xl text-lg text-pretty text-muted">{finalCta.text}</p>
        <div className="mt-2 flex w-full flex-col items-center gap-4">
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <ButtonLink link={finalCta.primary} icon="arrow" size="lg" className="shadow-card" />
            <UnavailableButton label={finalCta.comingSoon} size="lg" />
          </div>
          <DemoNote>{finalCta.demoNote}</DemoNote>
        </div>
      </div>
    </Section>
  );
}
