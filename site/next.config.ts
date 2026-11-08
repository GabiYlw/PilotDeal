import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML, CSS and JS in out/, served from the root of pilotdeal.online. No server code.
  output: "export",
  // A static export has no image optimizer, so images are served as they are.
  images: { unoptimized: true },
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
