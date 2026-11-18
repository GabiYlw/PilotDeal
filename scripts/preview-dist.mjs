import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Serves dist/ (from build-cloudflare.mjs) on http://localhost:8788 the way Cloudflare Pages does,
// to check the built site and demo before deploying: /demo/deals is dist/demo/deals.html, a folder
// serves its index.html, _redirects rules apply, and a missing page gets the nearest 404.html.
// Local preview only; no dependencies.

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT ?? 8788);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
};

function readRedirects() {
  const file = join(dist, "_redirects");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 3)
    .map(([from, to, status]) => ({ from, to, status: Number(status) }));
}

function redirectFor(pathname, rules) {
  for (const { from, to, status } of rules) {
    if (from.endsWith("/*") && pathname.startsWith(from.slice(0, -1))) {
      return { location: to.replace(":splat", pathname.slice(from.length - 1)), status };
    }
    if (from === pathname) return { location: to, status };
  }
  return null;
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

// Stays inside dist/ whatever the URL says.
function resolve(pathname) {
  const local = normalize(join(dist, decodeURIComponent(pathname)));
  if (local !== dist && !local.startsWith(dist + sep)) return null;
  for (const candidate of [local, `${local}.html`, join(local, "index.html")]) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function nearest404(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  for (let depth = parts.length; depth >= 0; depth -= 1) {
    const candidate = join(dist, ...parts.slice(0, depth), "404.html");
    if (isFile(candidate)) return candidate;
  }
  return null;
}

const rules = readRedirects();

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  const redirect = redirectFor(pathname, rules);
  if (redirect) {
    response.writeHead(redirect.status, { Location: redirect.location }).end();
    return;
  }
  const file = resolve(pathname);
  const served = file ?? nearest404(pathname);
  if (!served) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(file ? 200 : 404, {
    "Content-Type": TYPES[extname(served)] ?? "application/octet-stream",
  });
  response.end(readFileSync(served));
}).listen(port, () => {
  console.log(`Serving ${dist} on http://localhost:${port}`);
});
