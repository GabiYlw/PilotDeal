import { header, site } from "@/content";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";
import { ButtonLink } from "./ui/button-link";
import { Container } from "./ui/primitives";

const NAV_LINK_CLASS =
  "rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground motion-reduce:transition-none";

// Sticky header. From md up the anchor links sit inline; on a phone they move into MobileMenu.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-card-border bg-surface">
      <Container className="flex h-16 items-center justify-between gap-3">
        <a
          href="#top"
          aria-label={site.homeLabel}
          className="flex min-h-11 shrink-0 items-center rounded-md py-2"
        >
          <Logo className="h-3 w-auto min-[400px]:h-3.5 sm:h-4" />
        </a>
        <nav aria-label={header.navLabel} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {header.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={NAV_LINK_CLASS}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          {/* The wrapper hides it on a phone (it moves into MobileMenu): a hidden class on the
              ButtonLink itself would lose to its own inline-flex. */}
          <div className="hidden sm:block">
            <ButtonLink link={header.cta} size="sm" />
          </div>
          <ThemeToggle />
          <MobileMenu />
        </div>
      </Container>
    </header>
  );
}
