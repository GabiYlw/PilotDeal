import type { ReactNode } from "react";
import { site, type LinkItem } from "@/content";

// A plain <a>: the site has a single page, and /demo is a separate app on the same domain, so
// there is no client-side routing to do. External links open in a new tab and say so.
export function SmartLink({
  link,
  className,
  children,
  onClick,
}: {
  link: LinkItem;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const external = link.external === true;
  return (
    <a
      href={link.href}
      className={className}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children ?? link.label}
      {external && <span className="sr-only"> {site.newTabHint}</span>}
    </a>
  );
}
