import {
  Binary,
  Cpu,
  Database,
  Gauge,
  Globe,
  Layers,
  LayoutDashboard,
  Route,
  Server,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { DiagramArrow, DiagramGroup, DiagramNode } from "@/components/ui/diagram";

// Same architecture as the Mermaid diagram in the README. The drawing is aria-hidden; screen
// readers get the figure name and this description instead. The diagram appears once per page.
const DESCRIPTION_ID = "architecture-description";
const DESCRIPTION =
  "Architecture: the browser talks only to the Next.js dashboard, which renders with Server " +
  "Components and Server Actions and calls the Express API over HTTP with JSON. In the API, " +
  "routes and controllers validate input with zod and call services, which hold the business " +
  "rules. Services use repositories, which reach PostgreSQL with pgvector through Prisma and " +
  "raw SQL; a PriorityScorer, rule-based or LLM, which asks the Claude API for the next action; " +
  "and an EmbeddingProvider, which runs the all-MiniLM-L6-v2 model locally with no network. " +
  "Services also ask Claude for Ask the Pilot answers.";

// From sm up the two node rows share three columns: node, arrow, node. The path snakes:
// Browser -> Next.js, down into Routes (right column), left to Services, down to the adapters.
const ROW = "grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center";

// One adapter per column: from lg up each arrow and external system sit under their adapter.
// On a phone the lanes stack below the API, so each label also names its source.
const LANES = [
  {
    source: "Repositories",
    label: "Prisma and SQL",
    dashed: false,
    node: { icon: Database, title: "PostgreSQL", detail: "with pgvector" },
  },
  {
    source: "PriorityScorer and Services",
    label: "next action and Ask answers",
    dashed: false,
    node: { icon: Sparkles, title: "Claude API", detail: "via @anthropic-ai/sdk" },
  },
  {
    source: "EmbeddingProvider",
    label: "local, no network",
    dashed: true,
    node: { icon: Cpu, title: "all-MiniLM-L6-v2", detail: "384 dimensions" },
  },
] as const;

export function ArchitectureDiagram() {
  return (
    <Card>
      <figure aria-label="PilotDeal architecture" aria-describedby={DESCRIPTION_ID}>
        <figcaption id={DESCRIPTION_ID} className="sr-only">
          {DESCRIPTION}
        </figcaption>
        <div aria-hidden="true" className="flex flex-col">
          <div className={ROW}>
            <DiagramNode icon={Globe} tone="slate" title="Browser" detail="talks only to Next.js" />
            <DiagramArrow direction="right" />
            <DiagramNode
              icon={LayoutDashboard}
              tone="slate"
              title="Next.js dashboard"
              detail="Server Components and Server Actions"
            />
          </div>

          <div className={ROW}>
            <DiagramArrow label="HTTP / JSON" className="sm:col-start-3" />
          </div>

          <DiagramGroup icon={Server} title="Express API">
            <div className={ROW}>
              {/* DOM order is the phone order; from sm up Routes moves under Next.js. */}
              <DiagramNode
                icon={Route}
                title="Routes and controllers"
                detail="zod validation"
                className="sm:col-start-3 sm:row-start-1"
              />
              <DiagramArrow direction="left" className="sm:col-start-2 sm:row-start-1" />
              <DiagramNode
                icon={Workflow}
                title="Services"
                detail="business rules"
                className="sm:col-start-1 sm:row-start-1"
              />
              <DiagramArrow className="sm:col-start-1 sm:row-start-2" />
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <DiagramNode icon={Layers} title="Repositories" detail="Prisma and raw SQL" />
              <DiagramNode icon={Gauge} title="PriorityScorer" detail="rules or LLM" />
              <DiagramNode icon={Binary} title="EmbeddingProvider" detail="transformers.js" />
            </div>
          </DiagramGroup>

          <div className="grid lg:grid-cols-3 lg:gap-3 lg:px-4">
            {LANES.map((lane) => (
              <div key={lane.node.title} className="flex flex-col">
                <DiagramArrow
                  dashed={lane.dashed}
                  label={
                    <>
                      <span className="lg:hidden">{lane.source}: </span>
                      {lane.label}
                    </>
                  }
                />
                <DiagramNode tone="navy" {...lane.node} />
              </div>
            ))}
          </div>
        </div>
      </figure>
    </Card>
  );
}
