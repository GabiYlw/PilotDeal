import { cn } from "@/lib/cn";

const MIN = 0;
const MAX = 100;

function clampScore(score: number): number {
  return Math.round(Math.min(MAX, Math.max(MIN, score)));
}

// Draws a priority score from 0 to 100. The API computes the score; this only displays it.
export function ScoreBar({
  score,
  label = "Priority score",
  className,
}: {
  score: number;
  label?: string;
  className?: string;
}) {
  const value = clampScore(score);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-surface-hover"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
      <span
        aria-hidden="true"
        className="w-7 text-right text-xs font-medium text-foreground tabular-nums"
      >
        {value}
      </span>
    </div>
  );
}
