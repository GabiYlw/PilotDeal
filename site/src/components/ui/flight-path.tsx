import { cn } from "@/lib/cn";

// The brand's line drawing: a dashed route through two teal waypoints to an amber one, "the next
// move". Pure decoration, so it is hidden from screen readers.
// It only uses tokens, so it follows the theme. Place it absolutely behind a section's content.
//
// Each variant is drawn for where it sits, so the line never runs through text or buttons:
// - "frame": wider than the hero screenshot and centered on it. The route rises from the bottom
//   left, passes behind the screenshot (which hides it) and comes out on the right to the amber
//   waypoint beside the screenshot's top corner. The waypoints sit in the margins, so it is only
//   for wide screens with room beside the screenshot.
// - "band": a low strip for the top padding of a section, above its text. It is anchored right,
//   so on a narrow screen the left of the route is cropped and the amber waypoint stays visible.
const VARIANTS = {
  frame: {
    viewBox: "0 0 1400 700",
    aspect: "xMidYMid meet",
    path: "M-20 690C40 650 90 600 140 560C420 400 900 420 1250 300C1290 260 1296 140 1290 80",
    waypoints: [
      { x: 140, y: 560 },
      { x: 1250, y: 300 },
    ],
    signal: { x: 1290, y: 80 },
  },
  band: {
    viewBox: "0 0 1200 120",
    aspect: "xMaxYMid slice",
    path: "M-20 108C120 104 200 96 260 90C460 76 600 70 760 62C900 54 1000 44 1090 38",
    waypoints: [
      { x: 260, y: 90 },
      { x: 760, y: 62 },
    ],
    signal: { x: 1090, y: 38 },
  },
};

// A full-width variant: a dashed wave from the left edge of its box to the right edge, with the
// same waypoints. The line stretches to any width (the stroke and dashes keep their size), so the
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

export function FlightPath({
  variant,
  className,
}: {
  variant: keyof typeof VARIANTS;
  className?: string;
}) {
  const { viewBox, aspect, path, waypoints, signal } = VARIANTS[variant];
  return (
    <svg
      aria-hidden="true"
      viewBox={viewBox}
      preserveAspectRatio={aspect}
      className={cn("pointer-events-none", className)}
    >
      <path
        d={path}
        fill="none"
        strokeWidth="2"
        strokeDasharray="6 10"
        strokeLinecap="round"
        className="stroke-border-strong"
      />
      {waypoints.map((point) => (
        <circle
          key={point.x}
          cx={point.x}
          cy={point.y}
          r="7"
          strokeWidth="3"
          className="fill-surface stroke-accent"
        />
      ))}
      <circle cx={signal.x} cy={signal.y} r="22" className="fill-signal-subtle" />
      <circle cx={signal.x} cy={signal.y} r="9" className="fill-signal" />
    </svg>
  );
}
