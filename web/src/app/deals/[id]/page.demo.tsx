import { DemoDealView } from "@/demo/components/demo-deal-view";
import { dealPageIds } from "@/demo/ids";

// One page per seeded deal plus the pool for deals created in the browser (see demo/ids.ts).
export const dynamicParams = false;

export function generateStaticParams() {
  return dealPageIds();
}

export default async function DemoDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DemoDealView id={id} />;
}
