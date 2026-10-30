import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS, stageBadgeVariant } from "@/lib/deal-display";
import type { DealStage } from "@/lib/types";

export function StageBadge({ stage }: { stage: DealStage }) {
  return <Badge variant={stageBadgeVariant(stage)}>{STAGE_LABELS[stage]}</Badge>;
}
