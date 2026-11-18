import { cn } from "@/lib/cn";

// The brand's line drawing: a dashed route through two teal waypoints to an amber one, "the next
// move". Pure decoration, so it is hidden from screen readers.
// It only uses tokens, so it follows the theme. Give it a positioned box (absolute or relative),
// because the dots are placed inside it, and keep it clear of text and buttons.
//
// A dashed wave from the left edge of its box to the right edge. The line stretches to any width (the stroke and dashes keep their size), so the
// waypoints are HTML dots placed at the same percentages, which keeps them round. Two periods of a
// wave: crests at 25% and 75%, troughs at 0%, 50% and 100%.
const WAVE = {
  path: "M0 85C150 85 150 15 300 15S450 85 600 85S750 15 900 15S1050 85 1200 85",
  waypoints: [
    { left: "25%", top: "15%" },
    { left: "50%", top: "85%" },
  ],
  signal: { left: "75%", top: "15%" },
};

export function FlightWave({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none", className)}>
      <svg viewBox="0 0 1200 100" preserveAspectRatio="none" className="size-full overflow-visible">
        <path
          d={WAVE.path}
          fill="none"
          strokeWidth="2"
          strokeDasharray="6 10"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-border-strong"
        />
      </svg>
      {WAVE.waypoints.map((point) => (
        <span
          key={point.left}
          style={point}
          className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-accent bg-surface"
        />
      ))}
      <span
        style={WAVE.signal}
        className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-signal-subtle"
      >
        <span className="size-4 rounded-full bg-signal" />
      </span>
    </div>
  );
}
