import { Suspense, type ReactNode } from "react";
import { HealthStatus } from "@/components/health-status";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TextLink } from "@/components/ui/text-link";

// 16px line icons; they draw with currentColor so they follow the theme.
function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-link">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        {children}
      </svg>
    </span>
  );
}

const FEATURES = [
  {
    title: "Priority scoring",
    description:
      "Ranks open deals from 0 to 100 using days since the last interaction, deal value, stage and expected close date.",
    href: "/deals",
    icon: <path d="M2 13h12M4 13V9M8 13V5M12 13V2" />,
  },
  {
    title: "AI next action",
    description:
      "Claude reads a deal's recent interactions and suggests the next best action, with a rule-based fallback.",
    href: "/deals",
    icon: <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />,
  },
  {
    title: "Ask your CRM",
    description:
      "Ask questions in plain English. Answers come only from your interaction notes and cite their sources.",
    href: "/ask",
    icon: <path d="M3 3.5h10v7H7l-3 2.5v-2.5H3z" />,
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-16">
      <header className="flex flex-col items-start gap-5">
        <Badge variant="neutral">AI-assisted mini CRM</Badge>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance text-foreground md:text-5xl">
          Know which deal to work on next.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted">
          PilotDeal ranks your pipeline by priority, suggests the next best action for every deal
          and answers questions about your customers from your own notes.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/deals">View deals</ButtonLink>
          <ButtonLink href="/ask" variant="secondary">
            Ask your CRM
          </ButtonLink>
        </div>
        <Suspense fallback={<Badge variant="neutral">Checking API status...</Badge>}>
          <HealthStatus />
        </Suspense>
      </header>

      <section aria-labelledby="features" className="flex flex-col gap-4">
        <h2 id="features" className="text-xs font-medium tracking-wide text-muted uppercase">
          Features
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex">
              <Card className="flex flex-1 flex-col gap-3">
                <Icon>{feature.icon}</Icon>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="flex-1">{feature.description}</CardDescription>
                <TextLink href={feature.href} className="text-sm">
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
        {/* Placeholder: replace with the architecture diagram. */}
        <EmptyState
          title="Architecture diagram coming soon"
          description="Next.js dashboard, Express API, PostgreSQL with pgvector, and Claude."
        />
      </section>

      <footer className="border-t border-border pt-6 text-sm">
        {/* Placeholder: replace # with the repository URL. */}
        <TextLink href="#">View the source on GitHub</TextLink>
      </footer>
    </div>
  );
}
