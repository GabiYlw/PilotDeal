import { spawnSync } from "node:child_process";

// Builds the static demo into out-demo/ (see DEMO_BUILD in next.config.ts). A script rather than
// `DEMO_BUILD=true next build`, which does not work in the Windows shell npm uses.
const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DEMO_BUILD: "true" },
});
process.exit(result.status ?? 1);
