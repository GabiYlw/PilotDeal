import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// The wrapper scrolls horizontally on narrow screens instead of squeezing columns.
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-card-border bg-surface shadow-card">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-canvas", className)} {...props} />;
}

export function TableBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

// Body rows highlight on hover; header rows do not.
export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-b-0 [tbody_&]:hover:bg-surface-hover",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "h-11 px-4 text-left text-xs font-semibold tracking-wider whitespace-nowrap text-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("h-14 px-4 py-3 text-foreground", className)} {...props} />;
}
