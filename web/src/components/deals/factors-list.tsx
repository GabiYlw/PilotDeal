import { factorLabel, formatPoints } from "@/lib/deal-display";
import type { PriorityFactor } from "@/lib/types";

export function FactorsList({ factors }: { factors: PriorityFactor[] }) {
  if (factors.length === 0) {
    return <p className="text-sm text-muted">No scoring factors</p>;
  }
  return (
    <ul aria-label="Scoring factors" className="flex flex-col gap-1.5">
      {factors.map((factor) => (
        <li key={factor.name} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted">{factorLabel(factor.name)}</span>
          <span className="text-foreground tabular-nums">{formatPoints(factor.points)}</span>
        </li>
      ))}
    </ul>
  );
}
