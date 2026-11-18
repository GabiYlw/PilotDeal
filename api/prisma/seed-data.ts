// The sample data: fictional clients, contacts, deals and interactions. Used by seed.ts (the
// database) and by src/scripts/export-demo-seed.ts (the static demo's JSON). Plain data with no
// Prisma import, so the export does not need a generated client or a database.
import type { DealStage } from "../src/modules/deals/deal-stages.js";
import type { InteractionType } from "../src/modules/interactions/interaction-types.js";

export interface SeedContact {
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface SeedInteraction {
  type: InteractionType;
  notes: string;
  daysAgo: number;
}

// All day offsets are relative to the time the seed runs, so "recent" and "overdue" stay true.
export interface SeedDeal {
  title: string;
  value: number;
  stage: DealStage;
  expectedCloseInDays: number | null;
  createdDaysAgo: number;
  closedDaysAgo: number | null;
  interactions: SeedInteraction[];
}

export interface SeedCompany {
  name: string;
  industry: string;
  website: string;
  contacts: SeedContact[];
  deals: SeedDeal[];
}

// All companies and people are fictional; domains use the reserved .example.com.
export const companies: SeedCompany[] = [
  {
    name: "Northwind Logistics",
    industry: "Logistics",
    website: "https://www.northwind-logistics.example.com",
    contacts: [
      {
        name: "Marta Kowalski",
        email: "marta.kowalski@northwind-logistics.example.com",
        phone: "+1 555 0101",
        role: "Head of Operations",
      },
      {
        name: "Daniel Okafor",
        email: "daniel.okafor@northwind-logistics.example.com",
        phone: "+1 555 0102",
        role: "Procurement Manager",
      },
      {
        name: "Elena Petrova",
        email: "elena.petrova@northwind-logistics.example.com",
        phone: "+1 555 0103",
        role: "CFO",
      },
    ],
    deals: [
      {
        title: "Warehouse route optimization platform",
        value: 48500,
        stage: "NEGOTIATION",
        expectedCloseInDays: -6,
        createdDaysAgo: 40,
        closedDaysAgo: null,
        interactions: [
          {
            type: "EMAIL",
            daysAgo: 30,
            notes:
              "Sent the intro deck and pricing sheet to Marta Kowalski. She forwarded it to her operations team.",
          },
          {
            type: "MEETING",
            daysAgo: 21,
            notes:
              "Product demo for Marta and Daniel Okafor. Main concern is the integration effort with their existing warehouse system.",
          },
          {
            type: "CALL",
            daysAgo: 9,
            notes:
              "Daniel asked for a 10% discount on a multi-year commitment. Need to check what approval we have for that.",
          },
          {
            type: "EMAIL",
            daysAgo: 2,
            notes:
              "Their legal team is reviewing the contract and wants changes to the SLA section. Elena Petrova will join the next call.",
          },
        ],
      },
      {
        title: "Driver mobile app pilot",
        value: 12000,
        stage: "LEAD",
        expectedCloseInDays: null,
        createdDaysAgo: 30,
        closedDaysAgo: null,
        interactions: [
          {
            type: "CALL",
            daysAgo: 25,
            notes:
              "Discovery call with Marta. Interest is real, but it is unclear who owns the budget for a driver app.",
          },
          {
            type: "NOTE",
            daysAgo: 23,
            notes: "Follow up after their quarter-end budget review. No contact since.",
          },
        ],
      },
    ],
  },
  {
    name: "Brightlake Software",
    industry: "SaaS",
    website: "https://www.brightlake.example.com",
    contacts: [
      {
        name: "Ravi Menon",
        email: "ravi.menon@brightlake.example.com",
        phone: "+1 555 0111",
        role: "CTO",
      },
      {
        name: "Sophie Laurent",
        email: "sophie.laurent@brightlake.example.com",
        phone: "+1 555 0112",
        role: "VP of Sales",
      },
    ],
    deals: [
      {
        title: "Annual analytics license renewal",
        value: 36000,
        stage: "PROPOSAL",
        expectedCloseInDays: 14,
        createdDaysAgo: 20,
        closedDaysAgo: null,
        interactions: [
          {
            type: "MEETING",
            daysAgo: 12,
            notes:
              "Renewal kickoff with Ravi Menon. Their usage is up 30% year over year, which supports a larger tier.",
          },
          {
            type: "EMAIL",
            daysAgo: 4,
            notes: "Sent the renewal proposal with tiered pricing to Ravi and Sophie Laurent.",
          },
          {
            type: "CALL",
            daysAgo: 1,
            notes:
              "Their CFO wants to compare our proposal with a competitor quote. Offered to walk through the price difference.",
          },
        ],
      },
      {
        title: "Customer support seat expansion (40 seats)",
        value: 18750.5,
        stage: "WON",
        expectedCloseInDays: -12,
        createdDaysAgo: 45,
        closedDaysAgo: 10,
        interactions: [
          {
            type: "EMAIL",
            daysAgo: 40,
            notes:
              "Sophie Laurent requested 40 additional support seats for the new regional team.",
          },
          {
            type: "CALL",
            daysAgo: 28,
            notes:
              "Negotiated the onboarding timeline. They want all seats live within three weeks of signing.",
          },
          {
            type: "MEETING",
            daysAgo: 11,
            notes: "Final terms agreed with Sophie and Ravi. Order form goes out today.",
          },
          {
            type: "NOTE",
            daysAgo: 10,
            notes: "Signed order form received. Handing over to customer success for onboarding.",
          },
        ],
      },
    ],
  },
  {
    name: "Cedar & Stone Architects",
    industry: "Architecture",
    website: "https://www.cedarandstone.example.com",
    contacts: [
      {
        name: "Tomas Berg",
        email: "tomas.berg@cedarandstone.example.com",
        phone: "+1 555 0121",
        role: "Managing Partner",
      },
      {
        name: "Aiko Tanaka",
        email: "aiko.tanaka@cedarandstone.example.com",
        phone: "+1 555 0122",
        role: "Office Manager",
      },
    ],
    deals: [
      {
        title: "Project management suite for three offices",
        value: 22400,
        stage: "QUALIFIED",
        expectedCloseInDays: -12,
        createdDaysAgo: 38,
        closedDaysAgo: null,
        interactions: [
          {
            type: "MEETING",
            daysAgo: 35,
            notes:
              "Needs assessment with Tomas Berg. The three offices currently coordinate projects in spreadsheets.",
          },
          {
            type: "EMAIL",
            daysAgo: 26,
            notes:
              "Tomas objected that the suite is too expensive compared with spreadsheets. Sent an ROI summary and have had no reply since.",
          },
        ],
      },
    ],
  },
  {
    name: "Helios Solar Systems",
    industry: "Renewable Energy",
    website: "https://www.helios-solar.example.com",
    contacts: [
      {
        name: "Carlos Ibarra",
        email: "carlos.ibarra@helios-solar.example.com",
        phone: "+1 555 0131",
        role: "Director of Projects",
      },
      {
        name: "Nadia Haddad",
        email: "nadia.haddad@helios-solar.example.com",
        phone: "+1 555 0132",
        role: "Head of Partnerships",
      },
      {
        name: "Oliver Grant",
        email: "oliver.grant@helios-solar.example.com",
        phone: "+1 555 0133",
        role: "Finance Controller",
      },
    ],
    deals: [
      {
        title: "Field service scheduling integration",
        value: 95000,
        stage: "NEGOTIATION",
        expectedCloseInDays: 7,
        createdDaysAgo: 50,
        closedDaysAgo: null,
        interactions: [
          {
            type: "MEETING",
            daysAgo: 45,
            notes:
              "Technical workshop with Carlos Ibarra and his engineers to map the scheduling integration points.",
          },
          {
            type: "EMAIL",
            daysAgo: 30,
            notes: "Returned the completed security questionnaire to Nadia Haddad.",
          },
          {
            type: "CALL",
            daysAgo: 15,
            notes:
              "Oliver Grant pushed back on the implementation fee. Said it is high compared with the license cost.",
          },
          {
            type: "MEETING",
            daysAgo: 5,
            notes:
              "Agreed on a phased rollout that spreads the implementation fee over two quarters.",
          },
          {
            type: "CALL",
            daysAgo: 1,
            notes:
              "Procurement asked for the final contract redlines by Friday. Preparing them with legal.",
          },
        ],
      },
      {
        title: "Inventory tracking add-on",
        value: 8900,
        stage: "LOST",
        expectedCloseInDays: -15,
        createdDaysAgo: 55,
        closedDaysAgo: 20,
        interactions: [
          {
            type: "EMAIL",
            daysAgo: 50,
            notes:
              "Pitched the inventory tracking add-on to Carlos Ibarra as an extension of the scheduling work.",
          },
          {
            type: "CALL",
            daysAgo: 38,
            notes:
              "Carlos said the timeline slipped to next fiscal year and the budget is frozen until then.",
          },
          {
            type: "NOTE",
            daysAgo: 22,
            notes: "Lost to an in-house solution their team decided to build. Revisit next year.",
          },
        ],
      },
    ],
  },
  {
    name: "Bluefin Retail Group",
    industry: "Retail",
    website: "https://www.bluefin-retail.example.com",
    contacts: [
      {
        name: "Hannah Weiss",
        email: "hannah.weiss@bluefin-retail.example.com",
        phone: "+1 555 0141",
        role: "Chief Operating Officer",
      },
      {
        name: "Mateo Silva",
        email: "mateo.silva@bluefin-retail.example.com",
        phone: "+1 555 0142",
        role: "IT Manager",
      },
    ],
    deals: [
      {
        title: "Point-of-sale analytics for 25 stores",
        value: 64000,
        stage: "PROPOSAL",
        expectedCloseInDays: -2,
        createdDaysAgo: 28,
        closedDaysAgo: null,
        interactions: [
          {
            type: "MEETING",
            daysAgo: 24,
            notes:
              "Requirements session with Hannah Weiss and the store operations leads covering reporting needs for 25 stores.",
          },
          {
            type: "EMAIL",
            daysAgo: 8,
            notes:
              "Sent the proposal. Waiting on Mateo Silva and the IT security review before they can sign.",
          },
          {
            type: "CALL",
            daysAgo: 3,
            notes:
              "Hannah asked to move the pilot start to next month because of the seasonal sales peak.",
          },
        ],
      },
    ],
  },
];
