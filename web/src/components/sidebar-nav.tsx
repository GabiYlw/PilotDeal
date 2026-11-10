"use client";

import { Building2, Handshake, House, type LucideIcon, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

// grow: on a phone the sections share the bar's spare width in proportion to their link count.
const SECTIONS: ReadonlyArray<{ label: string; grow: string; links: ReadonlyArray<NavLink> }> = [
  {
    label: "Workspace",
    grow: "grow-3",
    links: [
      { href: "/", label: "Home", icon: House },
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/deals", label: "Deals", icon: Handshake },
    ],
  },
  {
    label: "AI",
    grow: "grow",
    links: [{ href: "/ask", label: "Ask", icon: MessageSquareText }],
  },
];

// The label is hidden on a phone, but still names its list for assistive technology.
function sectionLabelId(label: string): string {
  return `nav-section-${label.toLowerCase()}`;
}

function isActive(pathname: string | undefined, href: string): boolean {
  if (pathname === undefined) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  const Icon = link.icon;
  return (
    <li className="flex-auto md:flex-none">
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          // Phone: a tab with the icon above the label, at least 44px tall. Desktop: icon and label in a row.
          "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs whitespace-nowrap transition-colors md:min-h-0 md:flex-row md:justify-start md:gap-2.5 md:px-3 md:py-2.5 md:text-sm",
          active
            ? "bg-accent font-semibold text-accent-foreground"
            : "font-medium text-muted hover:bg-surface-hover hover:text-foreground",
        )}
      >
        <Icon
          aria-hidden="true"
          strokeWidth={1.75}
          className={cn("size-[18px] shrink-0", !active && "text-link")}
        />
        {link.label}
      </Link>
    </li>
  );
}

// No hooks, so it can render in the static shell. Without a pathname no link is highlighted.
export function NavLinks({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Main">
      <div className="flex gap-1 md:flex-col md:gap-5">
        {SECTIONS.map((section) => (
          <div key={section.label} className={cn("flex flex-col gap-1.5 md:grow-0", section.grow)}>
            <p
              id={sectionLabelId(section.label)}
              className="hidden px-3 text-[11px] font-semibold tracking-wider text-muted uppercase md:block"
            >
              {section.label}
            </p>
            <ul
              aria-labelledby={sectionLabelId(section.label)}
              className="flex gap-1 md:flex-col md:gap-0.5"
            >
              {section.links.map((link) => (
                <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

// Adds the active highlight once the current path is known.
export function SidebarNav() {
  return <NavLinks pathname={usePathname()} />;
}
