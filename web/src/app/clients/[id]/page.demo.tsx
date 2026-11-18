import { DemoCompanyView } from "@/demo/components/demo-company-view";
import { companyPageIds } from "@/demo/ids";

// One page per seeded client plus the pool for clients created in the browser (see demo/ids.ts).
export const dynamicParams = false;

export function generateStaticParams() {
  return companyPageIds();
}

export default async function DemoCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DemoCompanyView id={id} />;
}
