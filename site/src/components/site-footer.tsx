import { footer } from "@/content";
import { Logo } from "./logo";
import { Container } from "./ui/primitives";
import { SmartLink } from "./ui/smart-link";

export function SiteFooter() {
  return (
    <footer className="border-t border-card-border bg-surface py-10">
      <Container className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <Logo className="h-4 w-auto self-start" />
          <p className="text-sm text-muted">{footer.tagline}</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <nav aria-label={footer.linksLabel}>
            <ul className="flex gap-5">
              {footer.links.map((link) => (
                <li key={link.href}>
                  <SmartLink
                    link={link}
                    className="text-sm font-medium text-link underline-offset-4 hover:underline"
                  />
                </li>
              ))}
            </ul>
          </nav>
          <p className="font-mono text-xs text-muted">{footer.copyright}</p>
        </div>
      </Container>
    </footer>
  );
}
