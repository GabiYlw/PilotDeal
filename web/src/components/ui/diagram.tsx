import { ChevronDown, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconCircle, type IconTone } from "@/components/ui/icon-circle";
import { cn } from "@/lib/cn";

// Building blocks for simple box-and-arrow diagrams. They draw only with tokens, so a diagram
// looks the same in both themes. The drawing is decorative: give the diagram a text description
// for screen readers and hide the drawing with aria-hidden.

export function DiagramNode({
  icon,
  tone,
  title,
  detail,
  className,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  title: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl border border-card-border bg-surface px-4 py-3 shadow-card",
        className,
      )}
    >
      <IconCircle icon={icon} tone={tone} size="sm" />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold [overflow-wrap:anywhere] text-foreground">
          {title}
        </span>
        {detail && <span className="text-xs text-muted">{detail}</span>}
      </div>
    </div>
  );
}

function lineClass(dashed: boolean): string {
  return cn("border-muted", dashed && "border-dashed");
}

function DownArrow({ dashed }: { dashed: boolean }) {
  return (
    <span className="flex flex-col items-center text-muted">
      <span className={cn("h-5 border-l-2", lineClass(dashed))} />
      <ChevronDown className="-mt-2 size-4" strokeWidth={2.25} />
    </span>
  );
}

function SideArrow({ dashed, side }: { dashed: boolean; side: "left" | "right" }) {
  const Chevron = side === "right" ? ChevronRight : ChevronLeft;
  return (
    <span className={cn("flex items-center text-muted", side === "left" && "flex-row-reverse")}>
      <span className={cn("w-6 border-t-2", lineClass(dashed))} />
      <Chevron className={cn("size-4", side === "right" ? "-ml-2" : "-mr-2")} strokeWidth={2.25} />
    </span>
  );
}

export type DiagramArrowDirection = "down" | "right" | "left";

// "right" and "left" point sideways from sm up and down on a phone, where nodes stack.
// A labelled arrow stays centered: the label sits in the right-hand column and wraps there.
export function DiagramArrow({
  direction = "down",
  label,
  dashed = false,
  className,
}: {
  direction?: DiagramArrowDirection;
  label?: ReactNode;
  dashed?: boolean;
  className?: string;
}) {
  const arrow =
    direction === "down" ? (
      <DownArrow dashed={dashed} />
    ) : (
      <>
        <span className="sm:hidden">
          <DownArrow dashed={dashed} />
        </span>
        <span className="hidden sm:flex sm:items-center">
          <SideArrow dashed={dashed} side={direction} />
        </span>
      </>
    );
  if (!label) {
    return (
      <div className={cn("flex shrink-0 justify-center py-1 sm:px-1", className)}>{arrow}</div>
    );
  }
  return (
    <div className={cn("grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1", className)}>
      <span />
      {arrow}
      <span className="text-xs font-medium text-muted">{label}</span>
    </div>
  );
}

// A labelled boundary around the nodes that run in one process.
export function DiagramGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong bg-canvas p-4">
      <span className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
        {title}
      </span>
      {children}
    </div>
  );
}
