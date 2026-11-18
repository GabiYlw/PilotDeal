import { footer } from "@/content";
import { Logo } from "./logo";
import { SmartLink } from "./ui/smart-link";

// Logo and tagline, then the page's sections and the demo. Unlike the sections, it spans the full
// width of the window (no max-width Container), with side padding that grows with the screen.
// Links are at least 44px tall on a phone and wrap onto more rows when there is no room.
export function SiteFooter() {
  return (
    <footer className="border-t border-card-border bg-surface pt-14 pb-10 sm:pt-16">
      <div className="flex w-full flex-col gap-10 px-4 sm:px-6 lg:px-12 xl:px-16">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4">
            <Logo className="h-5 w-auto self-start sm:h-6" />
            <p className="text-lg text-muted sm:text-xl">{footer.tagline}</p>
          </div>
          <nav aria-label={footer.navLabel}>
            <ul className="-mx-3 flex flex-wrap gap-x-3 lg:justify-end">
              {footer.links.map((link) => (
                <li key={link.href}>
                  <SmartLink
                    link={link}
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-base font-medium text-foreground underline-offset-4 hover:text-link hover:underline"
                  />
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="border-t border-border pt-8 font-mono text-sm text-muted">
          {footer.copyright}
        </p>
      </div>
    </footer>
  );
}
