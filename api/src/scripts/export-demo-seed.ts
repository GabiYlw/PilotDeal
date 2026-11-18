import { demoSeed, writeDemoJson } from "./demo-data.js";

// Writes the seed data (clients, contacts, deals, interactions) to web/src/demo/data/seed.json for
// the static demo. Needs no database. Run it again whenever prisma/seed-data.ts changes.
const path = writeDemoJson("seed.json", demoSeed());
console.log(`Wrote ${path}`);
