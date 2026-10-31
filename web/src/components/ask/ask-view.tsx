import { Suspense } from "react";
import { ApiUnavailable } from "@/components/api-unavailable";
import { AskForm } from "@/components/ask/ask-form";
import { AskResults } from "@/components/ask/ask-results";
import { AskPending } from "@/components/ask/ask-skeleton";
import { DealScopeNotice } from "@/components/ask/deal-scope-notice";
import { ExampleQuestions } from "@/components/ask/example-questions";
import { getDeal } from "@/lib/api";
import { askHref, parseAskParams } from "@/lib/ask-display";
import { loadOptionalResource } from "@/lib/load";

export async function AskView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { question, dealId } = parseAskParams(await searchParams);
  let scopeTitle: string | null = null;
  if (dealId !== null) {
    // A missing scope deal is a state of this page, not a 404: the user can clear the scope.
    const scope = await loadOptionalResource(getDeal(dealId));
    if (scope.status === "unreachable") return <ApiUnavailable />;
    if (scope.status === "missing") {
      return <DealScopeNotice title={null} clearHref={askHref({ question })} />;
    }
    scopeTitle = scope.data.title;
  }
  return (
    <div className="flex flex-col gap-6">
      {scopeTitle !== null && (
        <DealScopeNotice title={scopeTitle} clearHref={askHref({ question })} />
      )}
      {question === null ? (
        <>
          <AskForm dealId={dealId} />
          <ExampleQuestions dealId={dealId} />
        </>
      ) : (
        // The key matters: next/form navigates with router.push inside a transition, which would
        // keep the old results on screen. A new key makes React treat this as a new boundary, so
        // the fallback shows for every new question. (useFormStatus does not track a string-action
        // Form.)
        <Suspense
          key={askHref({ question, dealId })}
          fallback={<AskPending question={question} dealId={dealId} />}
        >
          <AskResults question={question} dealId={dealId} />
        </Suspense>
      )}
    </div>
  );
}
