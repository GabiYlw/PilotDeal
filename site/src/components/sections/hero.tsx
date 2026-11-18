import { BrowserFrame } from "@/components/ui/browser-frame";
import { ButtonLink } from "@/components/ui/button-link";
import { CroppedScreenshot } from "@/components/ui/cropped-screenshot";
import { FlightWave } from "@/components/ui/flight-path";
import { DemoNote } from "@/components/ui/primitives";
import { hero } from "@/content";

// Above the fold, so it has no fade-in and its screenshot loads eagerly. It fills the first screen
// on its own: at least the viewport height minus the 64px sticky header (dvh, so mobile browser
// bars do not push it taller), with its content centered vertically. It is wider than the
// sections' max-width Container (96rem instead of 72rem), so on a wide screen the side margins are
// about half as wide. From lg up it is a split: the text on the left (5 of 12 columns), the screenshot on
// the right (7 of 12); below lg they stack, text first and centered. Above the content runs the
// same full-width flight wave as the final call to action, at the same height. It is in the normal
// flow rather than absolute, so it can never overlap the text or the buttons.
export function Hero() {
  const [first, second] = hero.headline;
  return (
    <section
      aria-labelledby="hero-title"
      className="flex min-h-[calc(100dvh-4rem)] flex-col gap-8 pt-5 pb-12 sm:gap-10 sm:pt-6 sm:pb-16"
    >
      <FlightWave className="relative h-12 w-full shrink-0 sm:h-16" />
      <div className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col px-4 sm:px-6 lg:px-12 xl:px-16">
        <div className="grid flex-1 content-center items-center gap-14 sm:gap-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 xl:gap-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center sm:gap-8 lg:mx-0 lg:items-start lg:text-left">
            <h1
              id="hero-title"
              className="text-4xl leading-[1.05] font-bold tracking-tight text-balance text-foreground sm:text-6xl lg:text-5xl xl:text-6xl 2xl:text-7xl"
            >
              <span className="block">{first}</span>
              <span className="block text-link">{second}</span>
            </h1>
            <p className="text-lg text-pretty text-muted sm:text-xl xl:text-2xl">{hero.intro}</p>
            <div className="flex w-full flex-col items-center gap-4 lg:items-start">
              <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap lg:justify-start">
                <ButtonLink link={hero.primary} icon="arrow" size="lg" />
                <ButtonLink link={hero.secondary} variant="secondary" icon="down" size="lg" />
              </div>
              <DemoNote>{hero.demoNote}</DemoNote>
            </div>
          </div>
          <BrowserFrame address={hero.browserAddress}>
            <CroppedScreenshot
              image={hero.screenshot}
              aspect="wide"
              eager
              sizes="(min-width: 1536px) 1100px, (min-width: 1024px) 70vw, 122vw"
            />
          </BrowserFrame>
        </div>
      </div>
    </section>
  );
}
