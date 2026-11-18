import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import type { LinkItem } from "@/content";
import { cn } from "@/lib/cn";
import { SmartLink } from "./smart-link";

export type ButtonLinkVariant = "primary" | "secondary";
export type ButtonLinkSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonLinkVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "border border-border-strong bg-surface text-foreground hover:border-accent",
};

const SIZES: Record<ButtonLinkSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

// A pill-shaped link that looks like a button, with an optional trailing arrow: "arrow" for a
// page on this domain, "down" for a section further down this page, "external" for a link that
// leaves the domain.
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
  icon?: "none" | "arrow" | "down" | "external";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <SmartLink
      link={link}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {link.label}
      {icon === "arrow" && <ArrowRight aria-hidden="true" strokeWidth={1.75} className="size-4" />}
      {icon === "down" && <ArrowDown aria-hidden="true" strokeWidth={1.75} className="size-4" />}
      {icon === "external" && (
        <ArrowUpRight aria-hidden="true" strokeWidth={1.75} className="size-4" />
      )}
    </SmartLink>
  );
}

// Looks like a secondary button but is plain text: not a link, not focusable, nothing happens on
// click, and the cursor stays the default arrow. The dashed border and muted text say it is not
// available yet.
export function UnavailableButton({
  label,
  size = "md",
  className,
}: {
  label: string;
  size?: ButtonLinkSize;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-dashed border-border-strong font-semibold whitespace-nowrap text-muted select-none",
        SIZES[size],
        className,
      )}
    >
      {label}
    </div>
  );
}
