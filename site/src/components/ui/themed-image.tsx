import Image from "next/image";
import type { ThemedImage as ThemedImageData } from "@/content";
import { cn } from "@/lib/cn";

// Both files are in the HTML and the --light-only / --dark-only tokens show the one that matches
// the active theme, like the ThemeToggle icons, so neither the first paint nor a toggle shows the
// wrong image. The hidden one has display: none, so screen readers announce only the visible one.
export function ThemedImage({
  image,
  sizes,
  eager = false,
  className,
}: {
  image: ThemedImageData;
  sizes?: string;
  /** Load both files at once: for small or above-the-fold images. */
  eager?: boolean;
  className?: string;
}) {
  const shared = {
    width: image.width,
    height: image.height,
    sizes,
    loading: eager ? ("eager" as const) : ("lazy" as const),
  };
  return (
    <>
      <Image
        {...shared}
        alt={image.alt}
        src={image.light}
        className={cn(className, "[display:var(--light-only)]")}
      />
      <Image
        {...shared}
        alt={image.alt}
        src={image.dark}
        className={cn(className, "[display:var(--dark-only)]")}
      />
    </>
  );
}
