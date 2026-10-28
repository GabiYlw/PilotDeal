import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { loadConfig } from "../src/config/env.js";

interface SeedContact {
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface SeedCompany {
  name: string;
  industry: string;
  website: string;
  contacts: SeedContact[];
}

// All companies and people are fictional; domains use the reserved .example.com.
const companies: SeedCompany[] = [
  {
    name: "Northwind Logistics",
    industry: "Logistics",
    website: "https://www.northwind-logistics.example.com",
    contacts: [
      { name: "Marta Kowalski", email: "marta.kowalski@northwind-logistics.example.com", phone: "+1 555 0101", role: "Head of Operations" },
      { name: "Daniel Okafor", email: "daniel.okafor@northwind-logistics.example.com", phone: "+1 555 0102", role: "Procurement Manager" },
      { name: "Elena Petrova", email: "elena.petrova@northwind-logistics.example.com", phone: "+1 555 0103", role: "CFO" },
    ],
  },
  {
    name: "Brightlake Software",
    industry: "SaaS",
    website: "https://www.brightlake.example.com",
    contacts: [
      { name: "Ravi Menon", email: "ravi.menon@brightlake.example.com", phone: "+1 555 0111", role: "CTO" },
      { name: "Sophie Laurent", email: "sophie.laurent@brightlake.example.com", phone: "+1 555 0112", role: "VP of Sales" },
    ],
  },
  {
    name: "Cedar & Stone Architects",
    industry: "Architecture",
    website: "https://www.cedarandstone.example.com",
    contacts: [
      { name: "Tomas Berg", email: "tomas.berg@cedarandstone.example.com", phone: "+1 555 0121", role: "Managing Partner" },
      { name: "Aiko Tanaka", email: "aiko.tanaka@cedarandstone.example.com", phone: "+1 555 0122", role: "Office Manager" },
    ],
  },
  {
    name: "Helios Solar Systems",
    industry: "Renewable Energy",
    website: "https://www.helios-solar.example.com",
    contacts: [
      { name: "Carlos Ibarra", email: "carlos.ibarra@helios-solar.example.com", phone: "+1 555 0131", role: "Director of Projects" },
      { name: "Nadia Haddad", email: "nadia.haddad@helios-solar.example.com", phone: "+1 555 0132", role: "Head of Partnerships" },
      { name: "Oliver Grant", email: "oliver.grant@helios-solar.example.com", phone: "+1 555 0133", role: "Finance Controller" },
    ],
  },
  {
    name: "Bluefin Retail Group",
    industry: "Retail",
    website: "https://www.bluefin-retail.example.com",
    contacts: [
      { name: "Hannah Weiss", email: "hannah.weiss@bluefin-retail.example.com", phone: "+1 555 0141", role: "Chief Operating Officer" },
      { name: "Mateo Silva", email: "mateo.silva@bluefin-retail.example.com", phone: "+1 555 0142", role: "IT Manager" },
    ],
  },
];

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });

  try {
    // Idempotent: the cascade removes the contacts of the deleted companies.
    await prisma.company.deleteMany();

    for (const { contacts, ...company } of companies) {
      await prisma.company.create({ data: { ...company, contacts: { create: contacts } } });
    }

    const contactCount = companies.reduce((sum, company) => sum + company.contacts.length, 0);
    console.log(`Seeded ${companies.length} companies and ${contactCount} contacts.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
