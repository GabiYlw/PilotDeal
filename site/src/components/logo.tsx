import { ThemedImage } from "@/components/ui/themed-image";
import { site } from "@/content";

// The artwork (icon and wordmark) is about 14.3:1. Intrinsic size at 16px high.
const LOGO = {
  light: "/brand/pilotdeal-logo.svg",
  dark: "/brand/pilotdeal-logo-white.svg",
  alt: site.logoAlt,
  width: 229,
  height: 16,
};

// The dark artwork in the light theme, the white one in the dark theme. Both load eagerly (they
// are tiny), so switching themes never waits for a download.
export function Logo({ className }: { className?: string }) {
  return <ThemedImage image={LOGO} eager className={className} />;
}
