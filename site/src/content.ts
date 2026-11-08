// Every text and link on the site. Components only render what is here.
// Each claim must stay true for PilotDeal as it is today (see api/ and web/).

export interface LinkItem {
  label: string;
  href: string;
  /** Opens in a new tab, with "(opens in a new tab)" for screen readers. */
  external?: boolean;
}

/** A paragraph made of plain text and links. */
export type RichText = (string | LinkItem)[];

export interface ThemedImage {
  light: string;
  dark: string;
  alt: string;
  width: number;
  height: number;
}

const GITHUB_REPO = "https://github.com/GabiYlw/PilotDeal";
const GITHUB_PROFILE = "https://github.com/GabiYlw";
const LINKEDIN = "https://www.linkedin.com/in/gabriel-galbenu-68b753359/";
const DEMO = "/demo";
const AUTHOR = "Galbenu Florin Gabriel";

// The screenshots in docs/screenshots/ are all 2880 x 2048.
function screenshot(name: string, alt: string): ThemedImage {
  return {
    light: `/screenshots/${name}-light.png`,
    dark: `/screenshots/${name}-dark.png`,
    alt,
    width: 2880,
    height: 2048,
  };
}

const SCREENSHOTS = {
  deals: screenshot(
    "deals",
    "PilotDeal deals page: open deals ranked by priority score, each with its stage, value and next action.",
  ),
  dealDetail: screenshot(
    "deal-detail",
    "PilotDeal deal page: the deal's details, its next action card with the score factors, and its interaction timeline.",
  ),
  ask: screenshot(
    "ask",
    "PilotDeal Ask page: a plain-English question, a generated answer citing sources, and the matching notes.",
  ),
};

export const site = {
  url: "https://pilotdeal.online",
  name: "PilotDeal",
  title: "PilotDeal: an AI-assisted mini CRM",
  description:
    "PilotDeal ranks your open deals, explains why, and answers questions from your own client notes, with sources.",
  ogImage: { path: "/og.png", width: 1200, height: 630, alt: "PilotDeal" },
  logoAlt: "PilotDeal",
  homeLabel: "PilotDeal home",
  skipLink: "Skip to content",
  newTabHint: "(opens in a new tab)",
};

export const header = {
  navLabel: "Main",
  links: [
    { label: "The problem", href: "#problem" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Under the hood", href: "#under-the-hood" },
    { label: "FAQ", href: "#faq" },
  ] satisfies LinkItem[],
  cta: { label: "Try the demo", href: DEMO } satisfies LinkItem,
  menuOpen: "Open menu",
  menuClose: "Close menu",
  theme: {
    toDark: "Switch to dark theme",
    toLight: "Switch to light theme",
    unknown: "Switch theme",
  },
};

export const hero = {
  headline: ["Know which deal matters.", "And what to do next."] as const,
  intro:
    "PilotDeal is an AI-assisted mini CRM that ranks your open deals, explains why, and answers questions from your own client notes, with sources.",
  primary: { label: "Try the live demo", href: DEMO } satisfies LinkItem,
  secondary: { label: "View on GitHub", href: GITHUB_REPO, external: true } satisfies LinkItem,
  screenshot: SCREENSHOTS.deals,
  browserAddress: "pilotdeal.online/demo/deals",
};

export const problem = {
  id: "problem",
  eyebrow: "The problem",
  title: "A morning in a typical CRM",
  intro: "The data is all there. Knowing where to start is not.",
  timelineLabel: "A sales rep's morning",
  timeline: [
    { time: "09:00", text: "Opens the CRM. 40 open deals, no idea where to start." },
    { time: "09:20", text: "Scrolls through old notes to find what a client said about pricing." },
    { time: "09:45", text: "Follows up with whoever replied last, not whoever matters most." },
    { time: "10:05", text: "Notices a close date passed 12 days ago." },
  ],
  highlight: {
    time: "09:01",
    label: "with PilotDeal",
    text: "the overdue deal is already at the top, with the reason and the next step.",
  },
};

export const howItWorks = {
  id: "how-it-works",
  eyebrow: "How it works",
  title: "From notes to a ranked pipeline",
  steps: [
    {
      number: "01",
      title: "Log your interactions",
      text: "Calls, emails, meetings and notes on each deal.",
      screenshot: SCREENSHOTS.dealDetail,
    },
    {
      number: "02",
      title: "See your pipeline ranked",
      text: "Every open deal gets a score, the factors behind it and a suggested next action.",
      screenshot: SCREENSHOTS.deals,
    },
    {
      number: "03",
      title: "Ask your notes",
      text: "Plain-English questions, answered only from your notes, with the sources cited.",
      screenshot: SCREENSHOTS.ask,
    },
  ],
};

export const comparison = {
  eyebrow: "Compared",
  title: "What changes",
  caption: "A typical CRM compared with PilotDeal",
  columns: { topic: "Question", typical: "A typical CRM", pilotDeal: "PilotDeal" },
  rows: [
    {
      topic: "What to work on next",
      typical: "You guess",
      pilotDeal: "Ranked, with the reasons",
    },
    {
      topic: "What a client said",
      typical: "You search old notes",
      pilotDeal: "Ask, and get sources",
    },
    {
      topic: "Overdue deals",
      typical: "You notice late",
      pilotDeal: "Flagged automatically",
    },
    {
      topic: "When the AI is wrong or down",
      typical: "n/a",
      pilotDeal: "It falls back to rules, and can never move a score by more than 20 points",
    },
  ],
};

// Sample values for the illustrations. They follow the real rules in api/src/scoring/
// (Negotiation 25, close date passed 25, 8+ days without contact 20, 20,000+ value 15).
export const underTheHood = {
  id: "under-the-hood",
  eyebrow: "Under the hood",
  title: "Built to be trusted, not just clever",
  illustrationNote: "Sample data",
  scores: {
    title: "Explainable scores",
    text: "Every score is the sum of named factors: stage, deal value, days since the last contact and the close date. You see each factor's points, never a black box.",
    dealTitle: "Fleet tracking renewal",
    overdue: "Overdue",
    scoreLabel: "Priority score",
    score: 85,
    factorsLabel: "Scoring factors",
    factors: [
      { label: "Stage", points: "+25" },
      { label: "Close date passed", points: "+25" },
      { label: "Days since last contact", points: "+20" },
      { label: "Deal value", points: "+15" },
    ],
  },
  sources: {
    title: "Answers with sources",
    text: "Ask finds the notes closest to your question, Claude answers only from them, and every claim cites its source. An answer that cites none of them is dropped.",
    question: "What did Northwind say about pricing?",
    answer: [
      "They asked for a discount on a two-year term ",
      { label: "S1" },
      " and want the final pricing in writing before Friday ",
      { label: "S2" },
      ".",
    ] as (string | { label: string })[],
    sources: [
      { label: "S1", type: "Email", cited: "Cited" },
      { label: "S2", type: "Call", cited: "Cited" },
    ],
  },
  fallback: {
    title: "Works without AI",
    text: "Without an API key, or when the AI fails or returns invalid output, the rule-based score is used. Ask still returns the most relevant notes.",
    rows: [
      { label: "API key set", badge: "Scored by AI", tone: "accent" as const },
      { label: "No key, or the AI fails", badge: "Scored by rules", tone: "neutral" as const },
    ],
  },
  guardrails: {
    title: "Guardrails",
    text: "The AI is treated as an untrusted helper.",
    items: [
      {
        title: "Validated output",
        text: "Claude answers through a fixed tool schema, checked again on the server.",
      },
      {
        title: "Grounding check",
        text: "An answer must cite at least one of the retrieved notes.",
      },
      {
        title: "Prompt injection protection",
        text: "Notes are escaped and marked as data, never instructions.",
      },
      {
        title: "Capped adjustment",
        text: "The AI can move a rule-based score by 20 points at most.",
      },
    ],
  },
  embeddings: {
    title: "Local embeddings",
    text: "Notes are embedded on the API server with all-MiniLM-L6-v2 and stored in PostgreSQL with pgvector. No third-party embedding service sees them.",
    flow: [
      { label: "Interaction notes", detail: "saved or edited" },
      { label: "all-MiniLM-L6-v2", detail: "runs on the API server" },
      { label: "pgvector", detail: "vector(384) in PostgreSQL" },
    ],
  },
  agents: {
    title: "Built with AI agents",
    text: "Features go through a Claude Code pipeline of four agents: a planner, a coder, a tester and a reviewer. No agent commits: a human reviews every change and commits it.",
    pipelineLabel: "Feature pipeline",
    steps: ["Planner", "Coder", "Tester", "Reviewer"],
    human: "Human review",
  },
  stack: {
    label: "Stack",
    items: [
      "Next.js",
      "Express",
      "PostgreSQL with pgvector",
      "Claude API",
      "Docker",
      "GitHub Actions",
    ],
  },
};

export const faq = {
  id: "faq",
  eyebrow: "FAQ",
  title: "Questions",
  items: [
    {
      question: "Is PilotDeal a real product?",
      answer: ["It is a portfolio project with a live demo running on sample data."],
    },
    {
      question: "What is sent to the AI?",
      answer: [
        "Only what one task needs, and only when an API key is set. To score a deal: that deal's details and its five most recent notes. To answer a question: the question and the notes found for it. Embeddings are computed on the server.",
      ],
    },
    {
      question: "What happens without an API key?",
      answer: [
        "Everything still works: scores come from rules, and Ask returns the most relevant notes without a generated answer.",
      ],
    },
    {
      question: "How is it built?",
      answer: [
        "The code, the architecture and the setup steps are in the ",
        { label: "GitHub repository", href: GITHUB_REPO, external: true },
        " and its ",
        { label: "README", href: `${GITHUB_REPO}#readme`, external: true },
        ".",
      ],
    },
    {
      question: "Who made it?",
      answer: [
        `${AUTHOR}. Find me on `,
        { label: "LinkedIn", href: LINKEDIN, external: true },
        " and ",
        { label: "GitHub", href: GITHUB_PROFILE, external: true },
        ".",
      ],
    },
  ] satisfies { question: string; answer: RichText }[],
};

export const finalCta = {
  title: "See it in action.",
  primary: hero.primary,
  secondary: hero.secondary,
};

export const footer = {
  tagline: "An AI-assisted mini CRM that ranks your deals and answers from your notes.",
  linksLabel: "Elsewhere",
  links: [
    { label: "GitHub", href: GITHUB_REPO, external: true },
    { label: "LinkedIn", href: LINKEDIN, external: true },
  ] satisfies LinkItem[],
  copyright: `© 2026 ${AUTHOR}`,
};
