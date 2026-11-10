import { ChartColumn, MessageSquareText, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { HealthStatus } from "@/components/health-status";
import { HomeStats, HomeStatsSkeleton } from "@/components/home-stats";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconCircle } from "@/components/ui/icon-circle";
import { TextLink } from "@/components/ui/text-link";

const REPOSITORY_URL = "https://github.com/GabiYlw/PilotDeal";

const FEATURES = [
  {
    title: "Priority scoring",
    description:
      "Ranks open deals from 0 to 100 using days since the last interaction, deal value, stage and expected close date.",
    href: "/deals",
    icon: ChartColumn,
    tone: "teal",
  },
  {
    title: "AI next action",
    description:
      "Claude reads a deal's recent interactions and suggests the next best action, with a rule-based fallback.",
    href: "/deals",
    icon: Sparkles,
    tone: "slate",
  },
  {
    title: "Ask the Pilot",
    description:
      "Ask questions in plain English. Answers come only from your interaction notes and cite their sources.",
    href: "/ask",
    icon: MessageSquareText,
    tone: "navy",
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12">
      <Banner
        title="Know which deal to work on next."
        description="PilotDeal ranks your pipeline by priority, suggests the next best action for every deal and answers questions about your customers from your own notes."
        actions={
          <>
            <ButtonLink href="/deals">View deals</ButtonLink>
            <ButtonLink href="/ask" variant="secondary">
              Ask the Pilot
            </ButtonLink>
          </>
        }
        footer={
          <Suspense fallback={<Badge variant="neutral">Checking API status...</Badge>}>
            <HealthStatus />
          </Suspense>
        }
      />

      <Suspense fallback={<HomeStatsSkeleton />}>
        <HomeStats />
      </Suspense>

      <section aria-labelledby="features" className="flex flex-col gap-4">
        <h2 id="features" className="text-xs font-medium tracking-wide text-muted uppercase">
          Features
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex">
              <Card className="flex flex-1 flex-col gap-3">
                <IconCircle icon={feature.icon} tone={feature.tone} />
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="flex-1">{feature.description}</CardDescription>
                <TextLink standalone href={feature.href} className="self-start text-sm">
                  Try it
                </TextLink>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="architecture" className="flex flex-col gap-4">
        <h2 id="architecture" className="text-xs font-medium tracking-wide text-muted uppercase">
          Architecture
        </h2>
        <ArchitectureDiagram />
      </section>

      <footer className="border-t border-border-strong pt-6 text-sm">
        <TextLink standalone href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
          View the source on GitHub
          <span className="sr-only"> (opens in a new tab)</span>
        </TextLink>
      </footer>
    </div>
  );
}
