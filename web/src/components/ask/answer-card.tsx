import { AnswerText } from "@/components/ask/answer-text";
import { Card, CardTitle } from "@/components/ui/card";

export function AnswerCard({ answer, labels }: { answer: string; labels: ReadonlySet<string> }) {
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle level={2}>Answer</CardTitle>
      <AnswerText answer={answer} labels={labels} />
    </Card>
  );
}
