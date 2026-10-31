import { AnswerCard } from "@/components/ask/answer-card";
import { SourceList } from "@/components/ask/source-list";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import {
  ASK_NO_AI_ANSWER_MESSAGE,
  ASK_NO_CLEAR_ANSWER_MESSAGE,
  ASK_NO_MATCHES_MESSAGE,
} from "@/lib/messages";
import type { AskResponse } from "@/lib/types";

// Only reads the flags the API sets; it decides nothing itself.
export function AskAnswer({ response }: { response: AskResponse }) {
  const { answer, answeredBy, insufficientInformation, citedInteractionIds, sources } = response;
  if (sources.length === 0) {
    return <EmptyState title={ASK_NO_MATCHES_MESSAGE} />;
  }
  const labels = new Set(sources.map((source) => source.label));
  const showAnswer = answeredBy === "llm" && typeof answer === "string" && answer.trim() !== "";
  return (
    <div className="flex flex-col gap-6">
      {answeredBy === "llm" && insufficientInformation && (
        <Notice>{ASK_NO_CLEAR_ANSWER_MESSAGE}</Notice>
      )}
      {answeredBy === "none" && <Notice>{ASK_NO_AI_ANSWER_MESSAGE}</Notice>}
      {showAnswer && <AnswerCard answer={answer} labels={labels} />}
      <SourceList sources={sources} citedIds={new Set(citedInteractionIds)} />
    </div>
  );
}
