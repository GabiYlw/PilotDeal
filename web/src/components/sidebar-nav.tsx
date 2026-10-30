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

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Client Component only to read the current path for the active link.
export function SidebarNav() {
  const pathname = usePathname();
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
