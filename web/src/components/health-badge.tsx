import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { API_NOT_RUNNING_MESSAGE } from "@/lib/messages";

export type ApiHealth = { api: "up"; database: "up" | "down" } | { api: "down" };

interface Look {
  variant: BadgeVariant;
  text: string;
}

const OK: Look = { variant: "success", text: "API and database are up" };

function lookFor(health: ApiHealth): Look {
  if (health.api === "down") {
    return {
      variant: "danger",
      text: API_NOT_RUNNING_MESSAGE,
    };
  }
  if (health.database === "down") {
    return {
      variant: "warning",
      text: "API is up, database is down. Start it with docker compose up -d db.",
    };
  }
  return OK;
}

export function HealthBadge({ health }: { health: ApiHealth }) {
  const look = lookFor(health);
  return (
    <Badge role="status" variant={look.variant}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {look.text}
    </Badge>
  );
}
