import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createContainer } from "./container.js";

const config = loadConfig();
const container = createContainer(config);
const app = createApp(container.controllers);

const server = app.listen(config.port, () => {
  console.log(`PilotDeal API listening on http://localhost:${config.port}`);
});

function shutdown(): void {
  server.close(() => {
    void container.disconnect().finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
