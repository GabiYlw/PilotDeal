import type { NextConfig } from "next";
import { readBasePath } from "./src/lib/base-path";

const nextConfig: NextConfig = {
  // Empty by default; the production image is built with BASE_PATH=/demo.
  basePath: readBasePath(process.env.BASE_PATH),
  // Emits .next/standalone (server.js plus only the files it needs) for the Docker image.
  // `next dev` and `next start` are unaffected.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // The Companies pages were renamed to Clients. Old links and bookmarks keep working (308).
  // Only page paths: the API keeps its /companies routes.
  async redirects() {
    return [
      { source: "/companies", destination: "/clients", permanent: true },
      { source: "/companies/:path*", destination: "/clients/:path*", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
