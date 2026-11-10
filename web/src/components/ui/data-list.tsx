import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

// The phone layout of a table: one card per row. Render it next to the Table with
// ResponsiveList, which shows the cards below md and the table from md up.
export function DataList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {children}
    </ul>
  );
}

// title is the row's main field (usually a link); eyebrow is an optional prefix such as a rank.
export function DataCard({
  title,
  eyebrow,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li>
      <Card className="flex flex-col gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          {eyebrow && <span className="shrink-0 text-xs text-muted tabular-nums">{eyebrow}</span>}
          <div className="min-w-0 text-base font-semibold [overflow-wrap:anywhere]">{title}</div>
        </div>
        {children && <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>}
      </Card>
    </li>
  );
}

// A label above its value. wide spans both columns, for long values (score, reason, URL).
export function DataField({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", wide && "col-span-2")}>
      <dt className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="text-sm [overflow-wrap:anywhere] text-foreground">{children}</dd>
    </div>
  );
}

// Cards below md, the table from md up. Only one is displayed, so assistive technology and
// keyboard users meet each row once.
export function ResponsiveList({ cards, table }: { cards: ReactNode; table: ReactNode }) {
  return (
    <>
      <div className="md:hidden">{cards}</div>
      <div className="hidden md:block">{table}</div>
    </>
  );
}
