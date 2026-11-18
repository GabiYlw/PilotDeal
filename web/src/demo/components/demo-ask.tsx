"use client";

import { useSearchParams } from "next/navigation";
import { AskAnswer } from "@/components/ask/ask-answer";
import { AskPageSkeleton } from "@/components/ask/ask-skeleton";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ChoiceLink } from "@/components/ui/choice-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { askHref } from "@/lib/ask-display";
import { PRESET_QUESTIONS, presetAnswer } from "../ask";
import { useDemoState } from "../store";

// Ask the Pilot in the demo: preset questions instead of a text field. Choosing one shows the
// answer the real app gave to it, with its cited notes, in the real app's answer components.
// The question is in the URL (?q=), like the real Ask page, so an answer can be linked to.
// useSearchParams needs a <Suspense> around this component in a static export.
export function DemoAsk() {
  const question = useSearchParams().get("q");
  const state = useDemoState();
  if (state === null) return <AskPageSkeleton />;
  if (PRESET_QUESTIONS.length === 0) {
    return <EmptyState title="No preset answers yet" />;
  }
  const response = question === null ? null : presetAnswer(question, state.loadedAt);
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle level={2}>Choose a question</CardTitle>
          <CardDescription>
            The demo answers these questions about the sample notes. Each answer was written once by
            the real app, with Claude, and cites the notes it used.
          </CardDescription>
        </div>
        <ul aria-label="Preset questions" className="flex flex-col gap-2">
          {PRESET_QUESTIONS.map((preset) => (
            <li key={preset}>
              <ChoiceLink
                href={askHref({ question: preset })}
                selected={preset === question}
                scroll={false}
              >
                {preset}
              </ChoiceLink>
            </li>
          ))}
        </ul>
      </Card>
      {question !== null && response === null && (
        <Notice>The demo only answers the questions above.</Notice>
      )}
      {response !== null && <AskAnswer response={response} />}
    </div>
  );
}
