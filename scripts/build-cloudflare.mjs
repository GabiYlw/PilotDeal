import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// One static folder for Cloudflare Pages: the presentation site at / and the dashboard's static
// demo at /demo. No server, no API, no database.
//
//   node scripts/build-cloudflare.mjs   (site and web dependencies must be installed)
//
// Output: dist/. Cloudflare Pages serves /demo/deals from dist/demo/deals.html and, for a missing
// page, the nearest 404.html (the demo's own under /demo).

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function run(args) {
  const result = spawnSync("npm", args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["--prefix", "site", "run", "build"]);
run(["--prefix", "web", "run", "build:demo"]);

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, "site", "out"), dist, { recursive: true });
cpSync(join(root, "web", "out-demo"), join(dist, "demo"), { recursive: true });

// The dashboard's old /companies URLs, which the full app redirects in next.config.ts. A static
// export has no redirects of its own, so the host does them.
if (existsSync(join(dist, "_redirects"))) {
  throw new Error("site/out already has a _redirects file; merge the demo's rules into it.");
}
writeFileSync(
  join(dist, "_redirects"),
  ["/demo/companies /demo/clients 301", "/demo/companies/* /demo/clients/:splat 301", ""].join(
    "\n",
  ),
);

console.log(`Built ${dist}: the site at / and the demo at /demo.`);
