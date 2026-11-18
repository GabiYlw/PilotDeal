"use client";

import { Handshake, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { CompanyDealsSection } from "@/components/companies/company-deals-section";
import { CompanyDetailSkeleton } from "@/components/companies/company-detail-skeleton";
import { CompanyDetails } from "@/components/companies/company-details";
import { ContactsSection } from "@/components/companies/contacts-section";
import { DeleteCompanyButton } from "@/components/companies/delete-company-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import {
  addContact,
  addDeal,
  editCompany,
  editContact,
  removeCompany,
  removeContact,
} from "../actions";
import { companyContacts, companyDeals, findCompany } from "../queries";
import { useDemoState } from "../store";
import { DeletedInDemo } from "./demo-states";

// The client page from the demo's data, laid out like the real CompanyView.
export function DemoCompanyView({ id }: { id: string }) {
  const state = useDemoState();
  if (state === null) return <CompanyDetailSkeleton />;
  const company = findCompany(state, id);
  if (!company) {
    if (state.deletedIds.has(id)) return <DeletedInDemo what="client" listHref="/clients" />;
    notFound();
  }
  const contacts = companyContacts(state, id);
  const deals = companyDeals(state, id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={company.name}
        description={company.industry ?? undefined}
        actions={
          <DeleteCompanyButton companyName={company.name} action={removeCompany.bind(null, id)} />
        }
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Clients", href: "/clients" },
          { label: company.name },
        ]}
      />
      <StatGrid>
        <StatCard icon={Users} tone="slate" label="Contacts" value={contacts.length} />
        <StatCard icon={Handshake} tone="teal" label="Deals" value={deals.length} />
      </StatGrid>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <CompanyDetails company={company} action={editCompany.bind(null, id)} />
          <ContactsSection
            contacts={contacts}
            total={contacts.length}
            addAction={addContact.bind(null, id)}
            actionsFor={(contact) => ({
              edit: editContact.bind(null, id, contact.id),
              remove: removeContact.bind(null, id, contact.id),
            })}
          />
        </div>
        <CompanyDealsSection
          deals={deals}
          total={deals.length}
          createAction={addDeal.bind(null, id)}
        />
      </div>
    </div>
  );
}
