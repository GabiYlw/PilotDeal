import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { IconCircle, type IconTone } from "@/components/ui/icon-circle";
import { cn } from "@/lib/cn";

// A grid of StatCards. It is a <dl>, so each label is announced with its value.
export function StatGrid({ className, ...props }: ComponentProps<"dl">) {
  return <dl className={cn("grid gap-5 sm:grid-cols-2", className)} {...props} />;
}

// One value the API returns directly (a total, a deal value). The web app never computes it.
export function StatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  label: string;
  value: ReactNode;
}) {
  return (
    <Card className="flex items-center gap-5">
      <IconCircle icon={icon} tone={tone} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <dt className="text-sm font-medium text-muted">{label}</dt>
        <dd className="text-3xl leading-none font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </dd>
      </div>
    </Card>
  );
}
