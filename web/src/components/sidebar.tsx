import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar() {
  return (
    <aside className="flex flex-col gap-4 border-b border-border bg-surface px-3 py-3 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-r md:border-b-0 md:py-4">
      <div className="flex items-center justify-between gap-2 md:contents">
        <Link href="/" className="flex items-center gap-2 px-2 text-sm font-semibold text-foreground">
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded bg-accent text-[11px] font-bold text-accent-foreground"
          >
            P
          </span>
          PilotDeal
        </Link>
        <div className="md:order-last md:mt-auto md:px-2">
          <ThemeToggle />
        </div>
      </div>
      <SidebarNav />
    </aside>
  );
}
