import { footer } from "@/content";
import { Logo } from "./logo";
import { Container } from "./ui/primitives";
import { SmartLink } from "./ui/smart-link";

// Logo and tagline, then the page's sections and the demo. Links are at least
// 44px tall on a phone and wrap onto more rows when there is no room.
export function SiteFooter() {
  return (
    <footer className="border-t border-card-border bg-surface pt-12 pb-8">
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-3">
            <Logo className="h-4 w-auto self-start" />
            <p className="text-base text-muted">{footer.tagline}</p>
          </div>
          <nav aria-label={footer.navLabel}>
            <ul className="-mx-2 flex flex-wrap gap-x-2 lg:justify-end">
              {footer.links.map((link) => (
                <li key={link.href}>
                  <SmartLink
                    link={link}
                    className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-foreground underline-offset-4 hover:text-link hover:underline md:min-h-9"
                  />
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="border-t border-border pt-6 font-mono text-xs text-muted">
          {footer.copyright}
        </p>
      </Container>
    </footer>
  );
}
