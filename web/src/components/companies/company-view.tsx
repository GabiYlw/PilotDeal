import { Handshake, Users } from "lucide-react";
import {
  addContact,
  addDeal,
  editCompany,
  editContact,
  removeCompany,
  removeContact,
} from "@/app/clients/[id]/actions";
import { ApiUnavailable } from "@/components/api-unavailable";
import { CompanyDealsSection } from "@/components/companies/company-deals-section";
import { CompanyDetails } from "@/components/companies/company-details";
import { ContactsSection } from "@/components/companies/contacts-section";
import { DeleteCompanyButton } from "@/components/companies/delete-company-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { getCompany, getCompanyContacts, getCompanyDeals } from "@/lib/api";
import { loadResource } from "@/lib/load";

const LIST_PAGE = { page: 1, pageSize: 100 };

// Reads params and calls the API, so it must be rendered inside <Suspense>.
export async function CompanyView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyResult = await loadResource(getCompany(id));
  if (companyResult.status === "unreachable") {
    return <ApiUnavailable />;
  }
  const company = companyResult.data;
  const [contactsResult, dealsResult] = await Promise.all([
    loadResource(getCompanyContacts(id, LIST_PAGE)),
    loadResource(getCompanyDeals(id, LIST_PAGE)),
  ]);
  if (contactsResult.status === "unreachable" || dealsResult.status === "unreachable") {
    return <ApiUnavailable />;
  }
  const { data: contacts, meta: contactsMeta } = contactsResult.data;
  const { data: deals, meta: dealsMeta } = dealsResult.data;
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
        <StatCard icon={Users} tone="slate" label="Contacts" value={contactsMeta.total} />
        <StatCard icon={Handshake} tone="teal" label="Deals" value={dealsMeta.total} />
      </StatGrid>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <CompanyDetails company={company} action={editCompany.bind(null, id)} />
          <ContactsSection
            contacts={contacts}
            total={contactsMeta.total}
            addAction={addContact.bind(null, id)}
            actionsFor={(contact) => ({
              edit: editContact.bind(null, id, contact.id),
              remove: removeContact.bind(null, id, contact.id),
            })}
          />
        </div>
        <CompanyDealsSection
          deals={deals}
          total={dealsMeta.total}
          createAction={addDeal.bind(null, id)}
        />
      </div>
    </div>
  );
}
