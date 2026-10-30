import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function ClosedDealNotice() {
  return (
    <Card className="flex flex-col gap-1">
      <CardTitle>This deal is closed</CardTitle>
      <CardDescription>Closed deals have no next action.</CardDescription>
    </Card>
  );
}
