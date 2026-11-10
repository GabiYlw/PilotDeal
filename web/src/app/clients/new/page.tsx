import { addCompany } from "@/app/clients/new/actions";
import { CompanyForm } from "@/components/companies/company-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function NewCompanyPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New client"
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Clients", href: "/clients" },
          { label: "New client" },
        ]}
      />
      <Card className="w-full max-w-xl">
        <CompanyForm
          action={addCompany}
          idPrefix="company"
          ariaLabel="New client"
          submitLabel="Create client"
          pendingLabel="Creating..."
          cancelHref="/clients"
          autoFocus
        />
      </Card>
    </div>
  );
}
