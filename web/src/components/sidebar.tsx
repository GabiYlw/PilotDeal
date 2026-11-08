import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "./logo";
import { NavLinks, SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar() {
  return (
    <aside className="flex flex-col gap-3 border-b border-card-border bg-surface px-4 py-3 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:gap-8 md:border-r md:border-b-0 md:px-4 md:py-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="flex min-w-0 items-center rounded-md px-1 py-2">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>
      {/* usePathname() is request-time data on dynamic routes, so it must sit inside Suspense.
          The fallback renders the same links without the highlight, so the nav is in the static
          shell and never appears late or shifts the page. */}
      <Suspense fallback={<NavLinks />}>
        <SidebarNav />
      </Suspense>
    </aside>
  );
}
