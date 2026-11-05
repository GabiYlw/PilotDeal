import {
  addContact,
  addDeal,
  editCompany,
  editContact,
  removeCompany,
  removeContact,
} from "@/app/companies/[id]/actions";
import { ApiUnavailable } from "@/components/api-unavailable";
import { CompanyDealsSection } from "@/components/companies/company-deals-section";
import { CompanyDetails } from "@/components/companies/company-details";
import { ContactsSection } from "@/components/companies/contacts-section";
import { DeleteCompanyButton } from "@/components/companies/delete-company-button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TextLink } from "@/components/ui/text-link";
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
          <>
            <TextLink href="/companies" className="text-sm">
              All companies
            </TextLink>
            <DeleteCompanyButton companyName={company.name} action={removeCompany.bind(null, id)} />
          </>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <CardTitle>Details</CardTitle>
            <CompanyDetails company={company} action={editCompany.bind(null, id)} />
          </Card>
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
