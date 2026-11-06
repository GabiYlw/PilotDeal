import { addCompany } from "@/app/companies/new/actions";
import { CompanyForm } from "@/components/companies/company-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function NewCompanyPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New company"
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Companies", href: "/companies" },
          { label: "New company" },
        ]}
      />
      <Card className="w-full max-w-xl">
        <CompanyForm
          action={addCompany}
          idPrefix="company"
          ariaLabel="New company"
          submitLabel="Create company"
          pendingLabel="Creating..."
          cancelHref="/companies"
          autoFocus
        />
      </Card>
    </div>
  );
}
