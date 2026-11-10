import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config redirects", () => {
  // The Companies pages were renamed to Clients; old links and bookmarks must keep working.
  it("permanently redirects /companies and every page under it to /clients", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual([
      { source: "/companies", destination: "/clients", permanent: true },
      { source: "/companies/:path*", destination: "/clients/:path*", permanent: true },
    ]);
  });
});
