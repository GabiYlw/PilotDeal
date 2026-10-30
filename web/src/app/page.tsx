import Link from "next/link";
import { Suspense } from "react";
import { HealthStatus } from "@/components/health-status";

const FEATURES = [
  {
    title: "Priority scoring",
    description:
      "Ranks open deals from 0 to 100 using days since the last interaction, deal value, stage and expected close date.",
    href: "/deals",
  },
  {
    title: "AI next action",
    description:
      "Claude reads a deal's recent interactions and suggests the next best action, with a rule-based fallback.",
    href: "/deals",
  },
  {
    title: "Ask your CRM",
    description:
      "Ask questions in plain English. Answers come only from your interaction notes and cite their sources.",
    href: "/ask",
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">PilotDeal</h1>
        <p className="text-slate-600">
          An AI-assisted mini CRM that tells you which deal to work on next and answers questions
          about your pipeline.
        </p>
        <Suspense fallback={<p className="text-sm text-slate-500">Checking API status...</p>}>
          <HealthStatus />
        </Suspense>
      </header>

      <section aria-labelledby="features" className="flex flex-col gap-4">
        <h2 id="features" className="text-xl font-semibold">
          Features
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5"
            >
              <h3 className="font-medium">{feature.title}</h3>
              <p className="flex-1 text-sm text-slate-600">{feature.description}</p>
              <Link href={feature.href} className="text-sm font-medium text-indigo-600 hover:underline">
                Try it
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="architecture" className="flex flex-col gap-4">
        <h2 id="architecture" className="text-xl font-semibold">
          Architecture
        </h2>
        {/* Placeholder: replace with the architecture diagram. */}
        <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500">
          Architecture diagram coming soon
        </div>
      </section>

      <footer className="text-sm text-slate-600">
        {/* Placeholder: replace # with the repository URL. */}
        <a href="#" className="font-medium text-indigo-600 hover:underline">
          View the source on GitHub
        </a>
      </footer>
    </div>
  );
}
