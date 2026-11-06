import { RELEVANCE_LABELS, type RelevanceLevel } from "@/lib/ask-display";
import { cn } from "@/lib/cn";

const FILLED_SEGMENTS: Record<RelevanceLevel, number> = { high: 3, medium: 2, low: 1 };

// A 3-segment level meter with a text label, so the level is not conveyed by color alone.
export function RelevanceIndicator({
  level,
  className,
}: {
  level: RelevanceLevel;
  className?: string;
}) {
  const filled = FILLED_SEGMENTS[level];
  const label = RELEVANCE_LABELS[level];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="meter"
        aria-label="Relevance"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={filled}
        aria-valuetext={label}
        className="flex gap-1"
      >
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={cn("h-1.5 w-4 rounded-full", segment <= filled ? "bg-accent" : "bg-canvas")}
          />
        ))}
      </div>
      <span className="text-xs text-muted">Relevance: {label}</span>
    </div>
  );
}
