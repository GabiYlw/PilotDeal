export type ApiHealth = { api: "up"; database: "up" | "down" } | { api: "down" };

interface Look {
  dot: string;
  box: string;
  text: string;
}

const OK: Look = {
  dot: "bg-emerald-500",
  box: "border-emerald-200 bg-emerald-50",
  text: "API and database are up",
};

function lookFor(health: ApiHealth): Look {
  if (health.api === "down") {
    return {
      dot: "bg-red-500",
      box: "border-red-200 bg-red-50",
      text: "API is not running. Start it with npm --prefix api run dev.",
    };
  }
  if (health.database === "down") {
    return {
      dot: "bg-amber-500",
      box: "border-amber-200 bg-amber-50",
      text: "API is up, database is down. Start it with docker compose up -d db.",
    };
  }
  return OK;
}

export function HealthBadge({ health }: { health: ApiHealth }) {
  const look = lookFor(health);
  return (
    <p
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-slate-700 ${look.box}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${look.dot}`} />
      {look.text}
    </p>
  );
}
