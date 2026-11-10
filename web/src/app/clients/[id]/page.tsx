import { Suspense } from "react";
import { CompanyDetailSkeleton } from "@/components/companies/company-detail-skeleton";
import { CompanyView } from "@/components/companies/company-view";

// params are only read inside Suspense so the shell can prerender with Cache Components.
export default function CompanyPage(props: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<CompanyDetailSkeleton />}>
      <CompanyView params={props.params} />
    </Suspense>
  );
}
