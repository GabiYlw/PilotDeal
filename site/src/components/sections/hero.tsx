import { BrowserFrame } from "@/components/ui/browser-frame";
import { ButtonLink } from "@/components/ui/button-link";
import { Container, DemoNote } from "@/components/ui/primitives";
import { ThemedImage } from "@/components/ui/themed-image";
import { hero } from "@/content";

// Above the fold, so it has no fade-in and its screenshot loads eagerly.
export function Hero() {
  const [first, second] = hero.headline;
  return (
    <section aria-labelledby="hero-title" className="pt-14 pb-16 sm:pt-20 sm:pb-24">
      <Container className="flex flex-col items-center gap-12 sm:gap-16">
        <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
          <h1
            id="hero-title"
            className="text-4xl font-bold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl"
          >
            <span className="block">{first}</span>
            <span className="block text-link">{second}</span>
          </h1>
          <p className="max-w-2xl text-base text-muted sm:text-lg">{hero.intro}</p>
          <div className="flex w-full flex-col items-center gap-3">
            <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <ButtonLink link={hero.primary} icon="arrow" />
              <ButtonLink link={hero.secondary} variant="secondary" icon="down" />
            </div>
            <DemoNote>{hero.demoNote}</DemoNote>
          </div>
        </div>
        <BrowserFrame address={hero.browserAddress} className="w-full max-w-5xl">
          <ThemedImage
            image={hero.screenshot}
            eager
            sizes="(min-width: 1088px) 1024px, 100vw"
            className="h-auto w-full"
          />
        </BrowserFrame>
      </Container>
    </section>
  );
}
