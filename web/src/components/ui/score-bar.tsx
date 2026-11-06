import { cn } from "@/lib/cn";

const MIN = 0;
const MAX = 100;

export type ScoreBarSize = "md" | "lg";

const SIZES: Record<ScoreBarSize, { track: string; number: string }> = {
  md: { track: "h-2.5", number: "w-8 text-sm" },
  lg: { track: "h-3.5", number: "w-12 text-2xl" },
};

function clampScore(score: number): number {
  return Math.round(Math.min(MAX, Math.max(MIN, score)));
}

// Draws a priority score from 0 to 100. The API computes the score; this only displays it.
export function ScoreBar({
  score,
  label = "Priority score",
  size = "md",
  className,
}: {
  score: number;
  label?: string;
  size?: ScoreBarSize;
  className?: string;
}) {
  const value = clampScore(score);
  const look = SIZES[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        className={cn("w-full min-w-16 overflow-hidden rounded-full bg-canvas", look.track)}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
      <span
        aria-hidden="true"
        className={cn("text-right font-bold text-foreground tabular-nums", look.number)}
      >
        {value}
      </span>
    </div>
  );
}
