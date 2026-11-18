import type { ReactNode } from "react";
import { Section, SectionHeading } from "@/components/ui/primitives";
import { howItWorks } from "@/content";
import { cn } from "@/lib/cn";
import { AskMockup, LogMockup, Marker, NextActionMockup } from "./step-mockups";

const TITLE_ID = "how-it-works-title";

// One mockup per step, in the order of howItWorks.steps.
const MOCKUPS: ReactNode[] = [
  <LogMockup key="log" />,
  <NextActionMockup key="next-action" />,
  <AskMockup key="ask" />,
];

// From lg up the mockup alternates sides. The text always comes first in the HTML, so the reading
// order stays text, then picture. The lettered notes match the markers in the mockup.
export function HowItWorks() {
  return (
    <Section id={howItWorks.id} labelledBy={TITLE_ID} className="bg-surface">
      <SectionHeading id={TITLE_ID} eyebrow={howItWorks.eyebrow} title={howItWorks.title} />
      <ol className="mt-10 flex flex-col gap-14 sm:mt-12 lg:gap-20">
        {howItWorks.steps.map((step, index) => (
          <li
            key={step.number}
            className="grid grid-cols-1 items-center gap-6 lg:grid-cols-5 lg:gap-14"
          >
            <div
              className={cn(
                "flex flex-col gap-4 lg:col-span-2",
                index % 2 === 1 && "lg:order-last",
              )}
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-accent-subtle font-mono text-sm font-semibold text-link">
                {step.number}
              </span>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="text-lg text-muted">{step.text}</p>
              <ul className="flex flex-col gap-2.5 border-t border-border pt-4">
                {step.annotations.map((note) => (
                  <li
                    key={note.marker}
                    className="flex items-start gap-3 text-base text-foreground"
                  >
                    <Marker letter={note.marker} className="mt-px" />
                    <span>{note.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-3">{MOCKUPS[index]}</div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
