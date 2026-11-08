import Image from "next/image";

// Intrinsic size at the phone height (16px); the artwork's aspect ratio is about 14.3:1.
const WIDTH = 229;
const HEIGHT = 16;

// Same height on a phone, a fixed width in the sidebar so it fits next to the ThemeToggle.
const SIZE_CLASS = "h-4 w-auto md:h-auto md:w-41";

// Both files are in the HTML and the --logo-on-light / --logo-on-dark tokens show the one that
// matches the active theme, like the ThemeToggle icons, so the first paint and a toggle never show
// the wrong logo. The hidden one has display: none, so screen readers announce only the visible one.
// "eager" loads the hidden file too, so switching themes never waits for a download.
export function Logo() {
  return (
    <>
      <Image
        src="/brand/pilotdeal-logo.svg"
        alt="PilotDeal"
        width={WIDTH}
        height={HEIGHT}
        loading="eager"
        className={`${SIZE_CLASS} [display:var(--logo-on-light)]`}
      />
      <Image
        src="/brand/pilotdeal-logo-white.svg"
        alt="PilotDeal"
        width={WIDTH}
        height={HEIGHT}
        loading="eager"
        className={`${SIZE_CLASS} [display:var(--logo-on-dark)]`}
      />
    </>
  );
}
