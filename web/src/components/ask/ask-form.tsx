import Form from "next/form";
import { Button } from "@/components/ui/button";
import { FieldError, FormError, Input, Label } from "@/components/ui/field";
import { errorProps } from "@/lib/error-props";

// A GET form: next/form navigates to /ask?q=... on the client, and the page reads the question
// from the URL. The same form (disabled) is the loading fallback.
export function AskForm({
  question,
  dealId,
  fieldError,
  formError,
  pending = false,
}: {
  question?: string | null;
  dealId?: string | null;
  fieldError?: string;
  formError?: string;
  pending?: boolean;
}) {
  return (
    <Form action="/ask" aria-label="Ask the Pilot" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ask-question">Question</Label>
        <div className="flex flex-col gap-2 min-[400px]:flex-row">
          <Input
            id="ask-question"
            name="q"
            defaultValue={question ?? ""}
            placeholder="Ask about your interaction notes"
            disabled={pending}
            className="min-[400px]:flex-1"
            {...errorProps("ask-question", fieldError)}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Searching..." : "Ask"}
          </Button>
        </div>
        <FieldError id="ask-question-error" message={fieldError} />
      </div>
      {dealId && <input type="hidden" name="dealId" value={dealId} />}
      <FormError message={formError} />
    </Form>
  );
}
