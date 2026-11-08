import { footer } from "@/content";
import { Logo } from "./logo";
import { Container } from "./ui/primitives";

export function SiteFooter() {
  return (
    <footer className="border-t border-card-border bg-surface py-10">
      <Container className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <Logo className="h-4 w-auto self-start" />
          <p className="text-sm text-muted">{footer.tagline}</p>
        </div>
        <p className="font-mono text-xs text-muted">{footer.copyright}</p>
      </Container>
    </footer>
  );
}
