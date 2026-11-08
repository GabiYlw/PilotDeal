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

const DEMO = "/demo";

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
  title: "PilotDeal: know which deal to work on next",
  description:
    "PilotDeal ranks your open deals, explains every score and suggests the next step. Ask questions in plain English and get answers from your own client notes, with sources.",
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
    { label: "Why PilotDeal", href: "#why-pilotdeal" },
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
  secondary: { label: "See how it works", href: "#how-it-works" } satisfies LinkItem,
  demoNote: "Live demo · sample data",
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
export const whyPilotDeal = {
  id: "why-pilotdeal",
  eyebrow: "Why PilotDeal",
  title: "AI your sales team can check",
  illustrationNote: "Sample data",
  scores: {
    title: "Explainable scores",
    text: "Every score adds up from named factors: stage, deal value, days since the last contact and the close date. Your team sees why a deal is at the top, not just that it is.",
    dealTitle: "Fleet tracking renewal",
    overdue: "Overdue",
    score: 85,
    factors: [
      { label: "Stage", points: "+25" },
      { label: "Close date passed", points: "+25" },
      { label: "Days since last contact", points: "+20" },
      { label: "Deal value", points: "+15" },
    ],
  },
  sources: {
    title: "Answers with sources",
    text: "Ask a question in plain English. The answer comes only from your team's notes and cites the notes it used. If the AI cannot point to a note, you get the matching notes instead.",
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
    text: "If the AI is switched off or unavailable, PilotDeal keeps ranking deals with its built-in rules, and Ask still finds the most relevant notes.",
    rows: [
      { label: "AI on", badge: "Scored by AI", tone: "accent" as const },
      { label: "AI off or unavailable", badge: "Scored by rules", tone: "neutral" as const },
    ],
  },
  guardrails: {
    title: "AI with guardrails",
    text: "The AI helps your team. It never gets the last word.",
    items: [
      {
        title: "Bounded scores",
        text: "The AI can move a rule-based score by 20 points at most.",
      },
      {
        title: "Grounded answers",
        text: "An answer must cite at least one of your notes, or it is not shown.",
      },
      {
        title: "Checked replies",
        text: "Every AI reply is checked before it reaches the screen; a malformed one is discarded.",
      },
      {
        title: "Notes stay data",
        text: "Your notes reach the AI as data, never as instructions.",
      },
    ],
  },
  privacy: {
    title: "Private by design",
    text: "Search over your notes runs on the PilotDeal server, so no outside search service sees them. The AI only receives the notes a single task needs.",
    flow: [
      { label: "Your notes", detail: "saved or edited" },
      { label: "Search index", detail: "built on the PilotDeal server" },
      { label: "Your database", detail: "stored next to your deals" },
    ],
  },
};

export const faq = {
  id: "faq",
  eyebrow: "FAQ",
  title: "Questions",
  items: [
    {
      question: "Can I trust the scores?",
      answer: [
        "Every score shows its working: the points for stage, deal value, days since the last contact and the close date add up to the score. If the AI adjusts it, the adjustment appears as its own line and is never more than 20 points, and each deal page shows whether it was scored by rules or by AI.",
      ],
    },
    {
      question: "Does the AI decide for me?",
      answer: [
        "No. PilotDeal suggests a priority and a next step, and you decide what to do. It never changes a deal on its own: stages, values and dates change only when someone edits them.",
      ],
    },
    {
      question: "Where is my data processed?",
      answer: [
        "Your deals and notes are stored in PilotDeal's database, and search over your notes runs on the PilotDeal server. Only when the AI features are on does PilotDeal send Claude, Anthropic's AI model, what one task needs: a deal's details and its five most recent notes to score it, or your question and the matching notes, with their deal and company names, to answer it.",
      ],
    },
    {
      question: "What happens if the AI is unavailable?",
      answer: [
        "Everything keeps working: scores come from the built-in rules, and Ask returns the most relevant notes without a generated answer.",
      ],
    },
  ] satisfies { question: string; answer: RichText }[],
};

export const finalCta = {
  title: "See it in action.",
  primary: hero.primary,
  demoNote: hero.demoNote,
};

export const footer = {
  tagline: "Know which deal matters, and what to do next.",
  copyright: "© 2026 PilotDeal",
};
