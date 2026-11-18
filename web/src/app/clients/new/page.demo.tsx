import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DemoNewCompanyForm } from "@/demo/components/demo-new-company";

export default function DemoNewCompanyPage() {
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
        <DemoNewCompanyForm />
      </Card>
    </div>
  );
}
