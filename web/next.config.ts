import path from "node:path";
import type { NextConfig } from "next";
import { readBasePath } from "./src/lib/base-path";

// DEMO_BUILD=true builds the static demo (npm run build:demo): a static export served at /demo,
// with no API, no database and no Server Actions. Its routes are the *.demo.tsx files, which read
// in-memory sample data (src/demo); the normal build ignores them, so it is unchanged.
const isDemo = process.env.DEMO_BUILD === "true";

const turbopackRules = {
  "*.css": {
    loaders: ["@tailwindcss/turbopack"],
    as: "*.css",
  },
};

const appConfig: NextConfig = {
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
  turbopack: { rules: turbopackRules },
};

// A static export cannot have redirects (the host does them: see scripts/build-cloudflare.mjs) or
// optimize images on request. The demo imports the API's scorer from ../api, so Turbopack's root
// is the repository (the build runs in web/). With a static export distDir is the output folder:
// out-demo/, apart from the app's .next. Its files are type-checked by `npm run typecheck` (tsconfig.demo.json), not during this
// build, whose generated route types would only cover the demo's routes.
const demoConfig: NextConfig = {
  basePath: "/demo",
  distDir: "out-demo",
  output: "export",
  pageExtensions: ["demo.tsx", "demo.ts"],
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  turbopack: { root: path.join(process.cwd(), ".."), rules: turbopackRules },
};

export default isDemo ? demoConfig : appConfig;
