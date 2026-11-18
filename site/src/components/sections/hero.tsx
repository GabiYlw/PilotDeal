import { BrowserFrame } from "@/components/ui/browser-frame";
import { ButtonLink } from "@/components/ui/button-link";
import { CroppedScreenshot } from "@/components/ui/cropped-screenshot";
import { FlightPath } from "@/components/ui/flight-path";
import { Container, DemoNote } from "@/components/ui/primitives";
import { hero } from "@/content";

// Above the fold, so it has no fade-in and its screenshot loads eagerly. The flight path never
// crosses the text or the buttons: below xl it is a low band in the top padding, from xl up it
// runs behind the screenshot and out into the margins beside it. isolate keeps its -z-10 inside
// this section.
export function Hero() {
  const [first, second] = hero.headline;
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden pt-16 pb-12 sm:pt-24 sm:pb-16"
    >
      <FlightPath
        variant="band"
        className="absolute inset-x-0 top-2 -z-10 h-12 w-full sm:top-3 sm:h-[4.5rem] xl:hidden"
      />
      <Container className="flex flex-col items-center gap-14 sm:gap-20">
        <div className="flex max-w-4xl flex-col items-center gap-6 text-center sm:gap-8">
          <h1
            id="hero-title"
            className="text-4xl leading-[1.08] font-bold tracking-tight text-balance text-foreground sm:text-6xl lg:text-7xl"
          >
            <span className="block">{first}</span>
            <span className="block text-link">{second}</span>
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted sm:text-xl">{hero.intro}</p>
          <div className="flex w-full flex-col items-center gap-4">
            <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <ButtonLink link={hero.primary} icon="arrow" size="lg" />
              <ButtonLink link={hero.secondary} variant="secondary" icon="down" size="lg" />
            </div>
            <DemoNote>{hero.demoNote}</DemoNote>
          </div>
        </div>
        <div className="relative w-full max-w-5xl">
          <FlightPath
            variant="frame"
            className="absolute top-1/2 left-1/2 -z-10 hidden aspect-[2/1] w-[140%] -translate-x-1/2 -translate-y-1/2 xl:block"
          />
          <BrowserFrame address={hero.browserAddress}>
            <CroppedScreenshot
              image={hero.screenshot}
              aspect="wide"
              eager
              sizes="(min-width: 1088px) 1250px, 122vw"
            />
          </BrowserFrame>
        </div>
      </Container>
    </section>
  );
}
