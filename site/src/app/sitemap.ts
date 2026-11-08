import type { MetadataRoute } from "next";
import { site } from "@/content";

// Required by output: "export": the file is generated once at build time.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: site.url, changeFrequency: "monthly", priority: 1 }];
}
