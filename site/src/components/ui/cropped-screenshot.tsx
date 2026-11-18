import type { ThemedImage as ThemedImageData } from "@/content";
import { cn } from "@/lib/cn";
import { ThemedImage } from "./themed-image";

// The screenshots are full 1440px dashboard pages, so shown whole their text is tiny. This shows
// the main column only, larger: the image is 122% of the frame's width and shifted left by 22% of
// the frame, which hides the sidebar (the left 18% of every screenshot, with its border); the aspect ratio crops
// the bottom. Nothing else changes, so the alt text still describes what is visible.
const ASPECTS = {
  wide: "aspect-[16/9]",
  step: "aspect-[4/3]",
};

export function CroppedScreenshot({
  image,
  aspect,
  sizes,
  eager = false,
}: {
  image: ThemedImageData;
  aspect: keyof typeof ASPECTS;
  /** The rendered image is 122% of the frame, so sizes should be too. */
  sizes: string;
  eager?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden", ASPECTS[aspect])}>
      <ThemedImage
        image={image}
        eager={eager}
        sizes={sizes}
        className="absolute top-0 left-[-22%] h-auto w-[122%] max-w-none"
      />
    </div>
  );
}
