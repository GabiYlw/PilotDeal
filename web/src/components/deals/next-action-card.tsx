import { FactorsList } from "@/components/deals/factors-list";
import { OverdueBadge } from "@/components/deals/overdue-badge";
import { ScoredByBadge } from "@/components/deals/scored-by-badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ScoreBar } from "@/components/ui/score-bar";
import type { DealNextAction } from "@/lib/types";

export function NextActionCard({ result }: { result: DealNextAction }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>Next action</CardTitle>
        <ScoredByBadge scoredBy={result.scoredBy} />
        <OverdueBadge factors={result.factors} />
      </div>
      <p className="text-lg leading-snug font-semibold text-foreground">{result.nextAction}</p>
      <ScoreBar score={result.score} label="Priority score" size="lg" />
      <CardDescription>{result.reason}</CardDescription>
      <FactorsList factors={result.factors} />
    </Card>
  );
}
