import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type IconTone = "teal" | "slate" | "navy";
export type IconCircleSize = "md" | "sm";

// Each tone is a background/foreground token pair from the palette (teal, slate #3a506b, navy).
const TONES: Record<IconTone, string> = {
  teal: "bg-accent-subtle text-link",
  slate: "bg-tint-slate text-tint-slate-foreground",
  navy: "bg-tint-navy text-tint-navy-foreground",
};

const SIZES: Record<IconCircleSize, { circle: string; icon: string }> = {
  md: { circle: "size-12", icon: "size-6" },
  sm: { circle: "size-9", icon: "size-[18px]" },
};

// An icon in a tinted circle. Decorative: the text next to it carries the meaning.
export function IconCircle({
  icon: Icon,
  tone = "teal",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: IconCircleSize;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        SIZES[size].circle,
        TONES[tone],
      )}
    >
      <Icon aria-hidden="true" className={SIZES[size].icon} strokeWidth={1.75} />
    </span>
  );
}
