import { AskAnswer } from "@/components/ask/ask-answer";
import { AskForm } from "@/components/ask/ask-form";
import { ApiUnavailable } from "@/components/api-unavailable";
import { runAsk } from "@/lib/ask";
import {
  ASK_SEARCH_STARTING_MESSAGE,
  DEAL_NOT_FOUND_MESSAGE,
} from "@/lib/messages";

// The form lives here (not in AskView) because API field errors are only known after the search
// and must sit next to the input.
export async function AskResults({
  question,
  dealId,
}: {
  question: string;
  dealId: string | null;
}) {
  const outcome = await runAsk(dealId === null ? { question } : { question, dealId });
  const form = (props: { fieldError?: string; formError?: string } = {}) => (
    <AskForm question={question} dealId={dealId} {...props} />
  );
  switch (outcome.status) {
    case "unreachable":
      return (
        <div className="flex flex-col gap-6">
          {form()}
          <ApiUnavailable />
        </div>
      );
    case "invalid":
      return form({ fieldError: outcome.fieldErrors.question, formError: outcome.formError });
    case "searchStarting":
      return form({ formError: ASK_SEARCH_STARTING_MESSAGE });
    case "dealMissing":
      return form({ formError: DEAL_NOT_FOUND_MESSAGE });
    case "ok":
      return (
        <div className="flex flex-col gap-6">
          {form()}
          <AskAnswer response={outcome.data} />
        </div>
      );
  }
}
