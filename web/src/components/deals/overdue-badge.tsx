import { Badge } from "@/components/ui/badge";
import { isOverdue } from "@/lib/deal-display";
import type { PriorityFactor } from "@/lib/types";

// Shows "Overdue" only when the API's scoring factors say the close date has passed.
export function OverdueBadge({ factors }: { factors: PriorityFactor[] }) {
  if (!isOverdue(factors)) {
    return null;
  }
  return <Badge variant="danger">Overdue</Badge>;
}
