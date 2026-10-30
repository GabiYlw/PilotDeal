"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/deals", label: "Deals" },
  { href: "/companies", label: "Companies" },
  { href: "/ask", label: "Ask" },
] as const;

function isActive(pathname: string | undefined, href: string): boolean {
  if (pathname === undefined) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// No hooks, so it can render in the static shell. Without a pathname no link is highlighted.
export function NavLinks({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Main">
      <ul className="flex gap-0.5 md:flex-col">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-surface-hover font-medium text-foreground"
                    : "text-muted hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Adds the active highlight once the current path is known.
export function SidebarNav() {
  return <NavLinks pathname={usePathname()} />;
}
