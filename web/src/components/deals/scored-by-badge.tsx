import { Badge } from "@/components/ui/badge";
import { scoredByLook } from "@/lib/deal-display";
import type { ScoredBy } from "@/lib/types";

export function ScoredByBadge({ scoredBy }: { scoredBy: ScoredBy }) {
  const look = scoredByLook(scoredBy);
  return <Badge variant={look.variant}>{look.text}</Badge>;
}
