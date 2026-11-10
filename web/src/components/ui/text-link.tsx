import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// standalone: a link that is not part of a sentence (a card title, a list of links). Below md it
// gets a 44px tap target; links inside running text keep the line height.
export function TextLink({
  standalone = false,
  className,
  ...props
}: { standalone?: boolean } & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "font-medium text-link underline-offset-4 hover:underline",
        standalone && "inline-flex min-h-11 min-w-11 items-center md:min-h-0 md:min-w-0",
        className,
      )}
      {...props}
    />
  );
}
