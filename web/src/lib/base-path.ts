// The sub-path the app is served under, read from BASE_PATH at build time (Next.js inlines
// basePath into the client bundles, so it cannot change at runtime). Production builds use
// BASE_PATH=/demo for pilotdeal.online/demo; unset or empty keeps the app at /.
// next/link, redirect(), next/form and the config redirects add the prefix themselves, so routes
// in the code stay "/deals", "/clients", ...
export function readBasePath(value: string | undefined): string {
  if (value === undefined || value === "") {
    return "";
  }
  if (!/^(\/[A-Za-z0-9._~-]+)+$/.test(value)) {
    throw new Error(
      `BASE_PATH must start with "/" and must not end with "/" (for example "/demo"), got "${value}".`,
    );
  }
  return value;
}
