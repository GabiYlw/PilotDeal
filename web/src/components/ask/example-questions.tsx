import { Card, CardTitle } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { askHref, EXAMPLE_QUESTIONS } from "@/lib/ask-display";

export function ExampleQuestions({ dealId }: { dealId: string | null }) {
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle level={2}>Try asking</CardTitle>
      <ul className="flex flex-col gap-2 text-sm">
        {EXAMPLE_QUESTIONS.map((question) => (
          <li key={question}>
            <TextLink href={askHref({ question, dealId })}>{question}</TextLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}
