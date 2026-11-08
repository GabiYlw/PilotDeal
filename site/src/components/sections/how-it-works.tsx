import { BrowserFrame } from "@/components/ui/browser-frame";
import { Section, SectionHeading } from "@/components/ui/primitives";
import { ThemedImage } from "@/components/ui/themed-image";
import { howItWorks } from "@/content";

const TITLE_ID = "how-it-works-title";

export function HowItWorks() {
  return (
    <Section id={howItWorks.id} labelledBy={TITLE_ID} className="bg-surface">
      <SectionHeading id={TITLE_ID} eyebrow={howItWorks.eyebrow} title={howItWorks.title} />
      <ol className="mt-12 flex flex-col gap-14 sm:gap-20">
        {howItWorks.steps.map((step) => (
          <li key={step.number} className="grid items-center gap-6 lg:grid-cols-5 lg:gap-12">
            <div className="flex flex-col gap-3 lg:col-span-2">
              <span className="font-mono text-sm font-semibold text-link">{step.number}</span>
              <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="text-base text-muted">{step.text}</p>
            </div>
            <BrowserFrame className="lg:col-span-3">
              <ThemedImage
                image={step.screenshot}
                sizes="(min-width: 1152px) 640px, (min-width: 1024px) 55vw, 100vw"
                className="h-auto w-full"
              />
            </BrowserFrame>
          </li>
        ))}
      </ol>
    </Section>
  );
}
