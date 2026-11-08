import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { LinkItem } from "@/content";
import { cn } from "@/lib/cn";
import { SmartLink } from "./smart-link";

export type ButtonLinkVariant = "primary" | "secondary";
export type ButtonLinkSize = "sm" | "md";

const VARIANTS: Record<ButtonLinkVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "border border-border-strong bg-surface text-foreground hover:border-accent",
};

const SIZES: Record<ButtonLinkSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
};

// A pill-shaped link that looks like a button, with an optional trailing arrow: "arrow" for a
// page on this domain, "external" for a link that leaves it.
export function ButtonLink({
  link,
  variant = "primary",
  size = "md",
  icon = "none",
  className,
  onClick,
}: {
  link: LinkItem;
  variant?: ButtonLinkVariant;
  size?: ButtonLinkSize;
  icon?: "none" | "arrow" | "external";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <SmartLink
      link={link}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 motion-reduce:transition-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {link.label}
      {icon === "arrow" && <ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-4" />}
      {icon === "external" && (
        <ArrowUpRight aria-hidden="true" strokeWidth={1.75} className="size-4" />
      )}
    </SmartLink>
  );
}
