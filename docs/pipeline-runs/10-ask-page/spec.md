# Spec: "Ask your CRM" page (web)

## Task

Build the `/ask` page of the Next.js dashboard. The user types a question into a `next/form` GET form (the question goes into the URL as `?q=`), and can scope it to one deal with `?dealId=`. The page calls `POST /ask` on the server and shows the cited answer, its state notices and the source cards. Add an "Ask about this deal" link to the deal page. The API is not changed.

## Baseline facts (verified in the repo)

- API `POST /ask` (`api/src/modules/ask/*`), body `{ question: string; dealId?: string; limit?: number }` (strict object, unknown keys rejected; the web never sends `limit`, the default is 5).
  - Validation: `question` is trimmed, then 3 to 500 characters. Messages: `"Question is required"` (missing), `"Question must be text"`, `"Question must be at least 3 characters"`, `"Question must be at most 500 characters"`. `dealId` must be a UUID: `"dealId must be a valid UUID"`. A failure returns 400 `{ error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: [{ path: ["question"], message }] } }`.
  - If `dealId` is a valid UUID but the deal does not exist: 404 `NOT_FOUND` (checked before embedding).
  - If the question cannot be embedded: 503 `{ error: { code: "EMBEDDING_UNAVAILABLE", ... } }`.
  - 200 response:
    ```
    { answer: string | null, answeredBy: "llm" | "none", insufficientInformation: boolean,
      citedInteractionIds: string[],
      sources: [{ label: "S1", interactionId, dealId, dealTitle, companyName,
                  type: "EMAIL"|"CALL"|"MEETING"|"NOTE", occurredAt: ISO string,
                  excerpt: string (max 300 code points), similarity: number 0..1, 3 decimals }] }
    ```
    `answeredBy: "none"` always comes with `answer: null`, `insufficientInformation: false`, `citedInteractionIds: []`. Labels are `S1..Sn` in source order. No rows: `answeredBy: "none"` and `sources: []`. The prompt asks the model for inline markers like `[S1]` or `[S1][S3]`; the model may also write `[S1, S2]`.
- `GET /deals/:id` returns 400 `VALIDATION_ERROR` for a non-UUID id and 404 `NOT_FOUND` for a missing deal.
- Web: `lib/api.ts` (`apiRequest`, `ApiError`, `API_UNREACHABLE`), `lib/load.ts` (`loadResource` calls `notFound()` on missing, which this page must NOT do for the scope deal), `lib/form-state.ts` (`toFormErrors` maps 400 details to field errors, leftovers to `formError`), `lib/messages.ts` (`DEAL_NOT_FOUND_MESSAGE = "This deal no longer exists."`), `lib/format.ts` (`formatDate`, UTC), `lib/deal-display.ts` (`INTERACTION_TYPE_LABELS`).
- UI components: `Card`/`CardTitle`/`CardDescription`, `Badge` (variants neutral/accent/success/warning/danger), `Button`/`ButtonLink`, `TextLink` (wraps `next/link`), `Input`/`Label`/`FieldError`/`FormError` (in `ui/field.tsx`), `Notice` (role=status, optional `action`), `EmptyState`, `PageHeader`, `Skeleton`. `errorProps(id, message)` in `lib/browser-validation.ts` gives `aria-invalid` + `aria-describedby="{id}-error"`.
- The sidebar already links to `/ask`; the home page already links to `/ask`. `/ask` currently 404s (no `app/ask/` folder).
- `next/form` (`web/node_modules/next/dist/client/app-dir/form.js`): with a string `action` it calls `event.preventDefault()` and `router.push(url)`. It is NOT a React form action, so `useFormStatus().pending` never becomes true for it (despite the doc example). The loading state must therefore come from Suspense fallbacks (see the plan). `method`, `encType`, `target` props are not allowed; a `key` on the `Form` itself is not supported.
- Metadata: `export const metadata: Metadata = { robots: { index: false } }` on a page renders `<meta name="robots" content="noindex">`.
- Tests: Vitest + RTL in `web/tests/unit/`. Async Server Components are tested as `render(await Component(props))` with `vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal()), getDeal: vi.fn(), ... }))`. Nested async children cannot be rendered by RTL, so they are mocked in the parent's test (see `companies-page.test.tsx`).

## Requirements

1. `GET /ask` renders a page with the header "Ask your CRM" and a question form built with `next/form` (`Form` from `"next/form"`) whose `action` is the string `"/ask"`. The text input is named `q`; submitting navigates to `/ask?q=<question>` (GET, client navigation).
2. The page's metadata sets `robots: { index: false }` and the title `"Ask your CRM"` (rendered as noindex).
3. When the URL has a `dealId` (non-empty string), the form carries it as a hidden input named `dealId`, so a submission keeps the scope (`/ask?q=...&dealId=...`).
4. Search params: `q` and `dealId` that arrive as arrays (repeated params) use the first value. `dealId=""` means no scope. `q` absent means "no question"; `q` present (any string, also empty or whitespace) means "a question was submitted" and is sent to the API untrimmed (the API trims and validates).
5. Deal scope, valid: the server calls `getDeal(dealId)` and shows a notice `"Scoped to: {deal.title}"` with a "Clear scope" link to the same URL without `dealId` (keeps `q` if present; `/ask` if not). The `POST /ask` body includes `dealId`.
6. Deal scope, invalid or missing (`getDeal` rejects with 404, or 400 `VALIDATION_ERROR`): show a notice containing `DEAL_NOT_FOUND_MESSAGE` ("This deal no longer exists.") with the same "Clear scope" link. No `POST /ask` call is made, and no form, examples or results are shown. The page does NOT call `notFound()`.
7. Deal scope, API unreachable on `getDeal` (status 0): render `<ApiUnavailable />`, no `POST /ask` call.
8. Without a question: show the form (empty) and three example questions, each a link to `/ask?q=<encoded question>` (plus `&dealId=<id>` when scoped to a valid deal), with texts exactly:
   - "Which customers are worried about price or budget?"
   - "Is a competitor involved in any deal?"
   - "Which deals are waiting on a contract?"
   No `POST /ask` call is made.
9. With a question: the server calls `askCrm({ question: q })` or `askCrm({ question: q, dealId })` (a new `lib/api.ts` function that sends `POST /ask`). The input keeps the submitted question as its default value.
10. Answer, `answeredBy: "llm"` with a non-empty `answer`: show an "Answer" card. The answer text is rendered as React text nodes only (never `dangerouslySetInnerHTML`, never parsed as HTML/Markdown), preserving line breaks (`whitespace-pre-line`).
11. Citation markers in the answer: `[S1]` and grouped `[S1, S2]` (any whitespace around commas, and around the inside of the brackets) become links. Each known label inside a marker becomes its own link with text `S1` and `href="#source-S1"`; brackets and commas stay as plain text. A label is "known" if some source in the response has that exact label (case-sensitive). Unknown labels stay plain text: `[S9]` renders exactly as the text `[S9]`; in a mixed group `[S1, S9]` only `S1` is a link and the rest (`[`, `, S9]`) is plain text. Anything that is not a well-formed marker (`[s1]`, `[S1 and S2]`, `[]`, `[S]`) stays plain text. Adjacent markers `[S1][S3]` both work.
12. Each source card has the DOM id `source-{label}` so marker links jump to it.
13. Cited sources (those whose `interactionId` is in `citedInteractionIds`) are visually highlighted: the card uses an accent border (via a new `highlighted` prop on `Card`) and shows a "Cited" badge (accent variant), so the state is not conveyed by color alone. Non-cited cards have neither.
14. `insufficientInformation: true` (with `answeredBy: "llm"`): show a notice "The notes don't contain a clear answer" above the answer card and the sources. The answer card is still shown when `answer` is a non-empty string.
15. `answeredBy: "none"` with at least one source: show a notice "No AI answer available. Showing the most relevant notes." above the sources; no answer card.
16. Source card contents: the label (e.g. `S1`), the company name, the deal title as a link to `/deals/{dealId}`, the interaction type badge (`INTERACTION_TYPE_LABELS`, e.g. "Email"), the date (`formatDate(occurredAt)` inside `<time dateTime={occurredAt}>`), the excerpt (plain text, `whitespace-pre-line break-words`), and a "Relevance" indicator.
17. Relevance indicator: derived from `similarity` into a level, never shown as a number or percentage: `similarity >= 0.6` -> "High", `>= 0.4` -> "Medium", otherwise "Low". It shows the visible text "Relevance: {Level}" and a 3-segment bar (3/2/1 segments filled), exposed as `role="meter"`, `aria-label="Relevance"`, `aria-valuemin=1`, `aria-valuemax=3`, `aria-valuenow` = 3/2/1, `aria-valuetext` = level text.
18. Sources are listed in API order (`<ol aria-label="Sources">`).
19. Empty `sources`: show `<EmptyState title="No notes matched your question" />` and nothing else from the result (no answer card, no state notices).
20. API validation errors (400 with `details`): the issue for path `["question"]` is shown next to the input via `FieldError` (id `ask-question-error`), and the input gets `aria-invalid="true"` and `aria-describedby="ask-question-error"`. Other issues (leftovers) are shown as a `FormError`. No results are shown.
21. `POST /ask` 503 with code `EMBEDDING_UNAVAILABLE`: show the form plus the form-level message "Search is starting up, try again in a moment" (`FormError`, role=alert). No results.
22. `POST /ask` 404 (deal deleted between the scope check and the search): show the form plus a `FormError` with `DEAL_NOT_FOUND_MESSAGE`.
23. `POST /ask` unreachable (status 0): show the form plus `<ApiUnavailable />`.
24. Any other `POST /ask` error (500, a 503 with another code, ...) is rethrown and handled by a new `app/ask/error.tsx` (same pattern as `app/companies/error.tsx`).
25. Loading state: while the answer is generated, the result area shows a fallback: the form with the submitted question, disabled, its submit button reading "Searching..." (disabled), and a results skeleton with `role="status"` and accessible name "Searching the notes". The fallback re-appears on every navigation to a different `q`/`dealId` (keyed Suspense). An `app/ask/loading.tsx` shows the header and a page skeleton when navigating to `/ask` from another route.
26. Deal page (`DealView`): the header actions include a link "Ask about this deal" with `href="/ask?dealId={deal id}"`.
27. `lib/types.ts` gains `AnsweredBy`, `AskSource`, `AskResponse`, `AskBody` mirroring the API.
28. No new dependencies. No API changes. All colors from tokens; pages built from `components/ui/` plus layout utilities.

## Acceptance criteria

1. `app/ask/page.tsx` exports `metadata` with `robots.index === false` and `title === "Ask your CRM"`.
2. Rendering the page shell shows a heading "Ask your CRM".
3. With no `q`: a form with accessible name "Ask your CRM" containing a textbox labelled "Question" (name `q`) and a submit button "Ask" is shown; `askCrm` is not called; three links with the exact example texts are shown, with hrefs `/ask?q=Which+customers+are+worried+about+price+or+budget%3F` style encoding (produced by `URLSearchParams`; tests compare against `"/ask?" + new URLSearchParams({ q }).toString()`).
4. With no `q` and a valid scope `dealId=d1`: example hrefs also contain `dealId=d1`; the form contains a hidden input `name="dealId" value="d1"`.
5. With a valid scope: text "Scoped to: Big deal" is shown, a "Clear scope" link points to `/ask` (no `q`) or `/ask?q=...` (with `q`, no `dealId`); `askCrm` is called with `{ question, dealId: "d1" }`.
6. With `getDeal` rejecting 404 `NOT_FOUND` or 400 `VALIDATION_ERROR`: text "This deal no longer exists." and a "Clear scope" link are shown; `askCrm` is not called; no textbox "Question" and no example links are rendered; `notFound` is not called.
7. With `getDeal` rejecting status 0: "Cannot reach the API" is shown and `askCrm` is not called.
8. `askCrm` is called with `{ question: q }` (no `dealId` key) when there is no scope, and `apiRequest` sends `POST /ask` with that JSON body (verified in `api.test.ts` style with mocked `fetch`).
9. `parseCitations("A [S1] b", {S1})` yields text "A ", citation S1, text " b"; for `[S1, S2]` both become links named "S1" and "S2" with hrefs `#source-S1` and `#source-S2`, and the rendered text content of the answer still reads "[S1, S2]".
10. `[S9]` (no source S9) renders no link and the answer text contains "[S9]"; `[S1, S9]` renders exactly one link ("S1") and the text content reads "[S1, S9]".
11. An answer `"<script>alert(1)</script> <b>bold</b> [S1]"` renders that literal text: the container has no `script` and no `b` element, and the visible text contains `<script>alert(1)</script>`.
12. A cited source card shows a "Cited" badge; a non-cited one does not. The cited card's root has the `border-accent` class and the non-cited one `border-border` (Card `highlighted` prop).
13. Each source card has `id="source-S{n}"`; shows label, company name, deal link (`/deals/{dealId}`) named with the deal title, type label ("Email" for `EMAIL`), formatted date, excerpt, and the relevance text.
14. Relevance: similarity 0.75 -> "Relevance: High", 0.6 -> High, 0.59 -> Medium, 0.4 -> Medium, 0.39 -> Low, 0.25 -> Low; the meter has `aria-valuetext` matching; no "%" character is rendered in the card.
15. `answeredBy: "llm"`, `insufficientInformation: false`: answer card shown; neither state notice shown.
16. `answeredBy: "llm"`, `insufficientInformation: true`: "The notes don't contain a clear answer" is shown, and it precedes (DOM order) the answer card and the sources list.
17. `answeredBy: "none"` with sources: "No AI answer available. Showing the most relevant notes." is shown before the sources list; no "Answer" card title.
18. `sources: []`: "No notes matched your question" is shown; no sources list, no answer card, no state notices.
19. `askCrm` rejecting 400 with `details: [{ path: ["question"], message: "Question must be at least 3 characters" }]`: that message is shown, the textbox has `aria-invalid="true"` and `aria-describedby="ask-question-error"`; no results.
20. `askCrm` rejecting `new ApiError("x", 503, "EMBEDDING_UNAVAILABLE")`: "Search is starting up, try again in a moment" is shown in an alert; the form is still present.
21. `askCrm` rejecting 404: "This deal no longer exists." is shown in an alert next to the form.
22. `askCrm` rejecting status 0: "Cannot reach the API" is shown; `askCrm` rejecting 500 (or 503 with another code) makes the component reject (error rethrown).
23. The pending fallback (`AskPending`) renders a disabled textbox with the question as value, a disabled "Searching..." button, and a status named "Searching the notes".
24. `DealView` renders a link "Ask about this deal" with href `/ask?dealId=d1`.
25. No file under `web/src` added by this task contains `dangerouslySetInnerHTML`; no raw colors or palette classes.
26. `npm --prefix web run lint`, `typecheck`, `test` and `build` pass; API lint, typecheck and tests still pass (no API change).

## Edge cases

- `q` absent vs `q=""` vs `q="   "`: absent shows examples; empty/whitespace is sent to the API, which answers 400 "Question must be at least 3 characters" shown next to the field.
- `q` longer than 500 characters (hand-edited URL): API 400 "Question must be at most 500 characters" shown next to the field. No HTML `maxLength`/`minLength`/`required` on the input: the API is the single source of validation, and its messages are shown inline.
- Repeated params `?q=a&q=b`, `?dealId=x&dealId=y`: first value wins.
- `dealId=""`: treated as no scope (no `getDeal` call, no hidden input).
- `dealId` not a UUID: `getDeal` returns 400 VALIDATION_ERROR -> "This deal no longer exists."; no search.
- Deal deleted after the scope check: `POST /ask` 404 -> form + "This deal no longer exists." alert.
- Special characters in `q` (`&`, `#`, `?`, unicode): links and the clear-scope href are built with `URLSearchParams`, never string concatenation.
- Answer contains HTML, Markdown, or something that looks like a marker but is not well-formed: rendered literally.
- Marker label repeated (`[S1] ... [S1]`): each occurrence becomes a link.
- Marker for a label that exists but is not cited: still a link (links target any source card; highlighting follows `citedInteractionIds`, not markers).
- `answeredBy: "llm"` with `answer` null or `""` (defensive): no answer card; the insufficient-info notice still shows if the flag is true.
- `sources: []` with any answeredBy: only the EmptyState.
- `citedInteractionIds` containing ids not in sources: ignored.
- `similarity` out of 0..1 (defensive): level mapping still returns Low/High by thresholds; never printed.
- Re-submitting the exact same question (same URL): the keyed Suspense keeps its key, so the old results stay visible until the new ones arrive (no fallback). Accepted.
- API down while loading the scope deal or running the search: `ApiUnavailable`.
- 503 with a code other than `EMBEDDING_UNAVAILABLE`: rethrown to `error.tsx`.
- Both themes: only tokens are used (`border-accent`, `bg-accent`, `bg-surface-hover`, `text-muted`, ...).

## Implementation plan

### Files to touch

| File | Reason |
|------|--------|
| `web/src/lib/types.ts` | Add `AnsweredBy`, `AskSource`, `AskResponse`, `AskBody`. |
| `web/src/lib/api.ts` | Add `askCrm(body)` (POST /ask) and export `EMBEDDING_UNAVAILABLE` code constant. |
| `web/src/lib/messages.ts` | Add the four new user-facing strings. |
| `web/src/lib/form-state.ts` | Add `AskField = "question"` type. |
| `web/src/lib/load.ts` | Add `loadOptionalResource` (missing -> `{ status: "missing" }` instead of `notFound()`). |
| `web/src/lib/ask-display.ts` (new) | Pure, client-safe helpers: `parseAskParams`, `askHref`, `EXAMPLE_QUESTIONS`, `relevanceLevel`, `RELEVANCE_LABELS`. |
| `web/src/lib/citations.ts` (new) | Pure `parseCitations(answer, knownLabels)` -> segments. |
| `web/src/lib/ask.ts` (new, `server-only`) | `runAsk(input)` -> `AskOutcome` (maps `ApiError`s to page states). |
| `web/src/components/ui/card.tsx` | Add `highlighted?: boolean` prop to `Card`. |
| `web/src/components/ui/relevance-indicator.tsx` (new) | 3-segment level meter with visible text. |
| `web/src/components/ask/ask-form.tsx` (new) | The `next/form` GET form (also used, disabled, as the pending fallback). |
| `web/src/components/ask/deal-scope-notice.tsx` (new) | "Scoped to: ..." / "This deal no longer exists." notice with "Clear scope". |
| `web/src/components/ask/example-questions.tsx` (new) | The three example links. |
| `web/src/components/ask/answer-text.tsx` (new) | Renders citation segments as text + `TextLink`s. |
| `web/src/components/ask/answer-card.tsx` (new) | Card "Answer" with `AnswerText`. |
| `web/src/components/ask/source-card.tsx` (new) | One source card. |
| `web/src/components/ask/source-list.tsx` (new) | `<ol aria-label="Sources">` of `SourceCard`s. |
| `web/src/components/ask/ask-answer.tsx` (new) | Chooses notices / answer card / sources / empty state from an `AskResponse`. |
| `web/src/components/ask/ask-results.tsx` (new, async) | Calls `runAsk`, renders form + errors or form + `AskAnswer`. |
| `web/src/components/ask/ask-view.tsx` (new, async) | Reads searchParams, resolves scope, renders notice/form/examples or keyed Suspense around `AskResults`. |
| `web/src/components/ask/ask-skeleton.tsx` (new) | `AskPageSkeleton`, `AskResultsSkeleton`, `AskPending`. |
| `web/src/app/ask/page.tsx` (new) | Static shell, metadata (noindex), Suspense around `AskView`. |
| `web/src/app/ask/loading.tsx` (new) | Header + `AskPageSkeleton`. |
| `web/src/app/ask/error.tsx` (new) | Copy of the companies error boundary. |
| `web/src/components/deals/deal-view.tsx` | Add "Ask about this deal" link to header actions. |
| `web/src/app/not-found.tsx` | Optional: update the comment (Ask now exists). Comment only. |
| Tests in `web/tests/unit/` | See Tests section. |

### Function-level changes

**`lib/types.ts`** (append, with a comment pointing at `api/src/modules/ask/ask.schemas.ts`):
```ts
export type AnsweredBy = "llm" | "none";
export interface AskSource { label: string; interactionId: string; dealId: string; dealTitle: string;
  companyName: string; type: InteractionType; occurredAt: string; excerpt: string; similarity: number; }
export interface AskResponse { answer: string | null; answeredBy: AnsweredBy; insufficientInformation: boolean;
  citedInteractionIds: string[]; sources: AskSource[]; }
// Raw form string: the API trims and validates it.
export interface AskBody { question: string; dealId?: string; }
```

**`lib/api.ts`**:
- `export const EMBEDDING_UNAVAILABLE = "EMBEDDING_UNAVAILABLE";` (comment: `/ask` answers 503 with this code while the embedding model cannot be used).
- `export function askCrm(body: AskBody): Promise<AskResponse> { return apiRequest<AskResponse>("/ask", { method: "POST", body }); }`

**`lib/messages.ts`**:
- `ASK_SEARCH_STARTING_MESSAGE = "Search is starting up, try again in a moment"`
- `ASK_NO_CLEAR_ANSWER_MESSAGE = "The notes don't contain a clear answer"`
- `ASK_NO_AI_ANSWER_MESSAGE = "No AI answer available. Showing the most relevant notes."`
- `ASK_NO_MATCHES_MESSAGE = "No notes matched your question"`
- Reuse existing `DEAL_NOT_FOUND_MESSAGE`.

**`lib/form-state.ts`**: `export type AskField = "question";`

**`lib/load.ts`**: add
```ts
export type OptionalLoadResult<T> = LoadResult<T> | { status: "missing" };
// Like loadResource, but a missing or malformed id is a normal result, not a 404 page.
export async function loadOptionalResource<T>(request: Promise<T>): Promise<OptionalLoadResult<T>>
```
Uses the existing `isMissing`/`isUnreachable`; anything else rethrown.

**`lib/ask-display.ts`** (no `server-only`, no imports from `api.ts`):
- `export interface AskParams { question: string | null; dealId: string | null }`
- `parseAskParams(params: Record<string, string | string[] | undefined>): AskParams` — first value of arrays; `q` undefined -> `null`; `dealId` undefined or `""` -> `null`. `q` not trimmed.
- `askHref({ question, dealId }: { question?: string | null; dealId?: string | null }): string` — builds with `URLSearchParams`, appending `q` first then `dealId`, only when non-null (`question` may be `""`? — only append when `question !== null && question !== undefined`); returns `"/ask"` when no params, else `` `/ask?${params}` ``.
- `export const EXAMPLE_QUESTIONS = [ ...the three exact strings ] as const;`
- `export type RelevanceLevel = "high" | "medium" | "low";`
- `export const HIGH_RELEVANCE = 0.6; export const MEDIUM_RELEVANCE = 0.4;` (comment: display bands for cosine similarity; the API already drops anything below 0.25).
- `relevanceLevel(similarity: number): RelevanceLevel`
- `export const RELEVANCE_LABELS: Record<RelevanceLevel, string> = { high: "High", medium: "Medium", low: "Low" };`

**`lib/citations.ts`**:
```ts
export type AnswerSegment = { kind: "text"; text: string } | { kind: "citation"; label: string };
export function parseCitations(answer: string, knownLabels: ReadonlySet<string>): AnswerSegment[]
```
- Marker regex: `/\[\s*(S\d+(?:\s*,\s*S\d+)*)\s*\]/g`.
- Walk matches with `matchAll`; text before a match is a text segment. Inside a match, split the original matched substring so the output text is preserved exactly: emit `"["`-prefix text (the `[` plus any leading whitespace), then for each label: a citation segment if known, else a text segment with the label; separators (`, ` with their original whitespace) and the closing `]` as text. Simplest robust approach: tokenise the matched substring with `/S\d+/g` and treat everything between label tokens as text.
- Merge adjacent text segments so unknown labels produce one contiguous text run (e.g. `[S9]` -> a single text segment `"[S9]"`; whole answer without known markers -> a single text segment).
- Invariant (test it): concatenating `text` of text segments and `label` of citation segments (with the brackets/separators already in text segments) reproduces the original answer exactly.
- Empty answer -> `[]`.

**`lib/ask.ts`** (`import "server-only"`):
```ts
export type AskOutcome =
  | { status: "ok"; data: AskResponse }
  | { status: "invalid"; fieldErrors: Partial<Record<AskField, string>>; formError?: string }
  | { status: "dealMissing" }
  | { status: "searchStarting" }
  | { status: "unreachable" };
export async function runAsk(body: AskBody): Promise<AskOutcome>
```
- `try { return { status: "ok", data: await askCrm(body) } } catch (error)`:
  - not `ApiError` -> rethrow.
  - `status === 0` -> unreachable.
  - `status === 400` -> `{ status: "invalid", ...toFormErrors(error, ASK_FIELDS) }` with `const ASK_FIELDS = ["question"] as const`.
  - `status === 404` -> dealMissing.
  - `status === 503 && code === EMBEDDING_UNAVAILABLE` -> searchStarting.
  - else rethrow.
- Keep `askCrm` imported from `./api` so tests can mock `@/lib/api`.

**`components/ui/card.tsx`**: `Card({ highlighted = false, className, ...props }: { highlighted?: boolean } & ComponentProps<"div">)` — base `"rounded-lg border bg-surface p-5"` plus `highlighted ? "border-accent" : "border-border"` (chosen inside the component because `cn` does not resolve conflicts). Comment: "highlighted marks a selected or cited card." Existing callers unchanged.

**`components/ui/relevance-indicator.tsx`**:
`RelevanceIndicator({ level, className }: { level: RelevanceLevel; className?: string })`
- Visible text `Relevance: {RELEVANCE_LABELS[level]}` (`text-xs text-muted`).
- `div role="meter" aria-label="Relevance" aria-valuemin={1} aria-valuemax={3} aria-valuenow={n} aria-valuetext={label}` containing 3 small segments (`h-1.5 w-4 rounded-full`), filled `bg-accent`, empty `bg-surface-hover`. Segment colors are tokens only. Import `RelevanceLevel`/`RELEVANCE_LABELS` from `@/lib/ask-display` (type + constant, client-safe).

**`components/ask/ask-form.tsx`** (Server-compatible, no `"use client"`; `Form` from `next/form` is itself a client component and takes a string action):
```ts
export function AskForm({ question, dealId, fieldError, formError, pending = false }:
  { question?: string | null; dealId?: string | null; fieldError?: string; formError?: string; pending?: boolean })
```
- `<Form action="/ask" aria-label="Ask your CRM" className="flex flex-col gap-3">`
- `Label htmlFor="ask-question"` "Question"; `Input id="ask-question" name="q" defaultValue={question ?? ""} placeholder="Ask about your interaction notes" disabled={pending} {...errorProps("ask-question", fieldError)}`; `FieldError id="ask-question-error" message={fieldError}`.
- `{dealId && <input type="hidden" name="dealId" value={dealId} />}`.
- `FormError message={formError}`.
- `Button type="submit" disabled={pending}` text `pending ? "Searching..." : "Ask"`.
- Layout: input and button in a row (`flex gap-2`, input `flex-1` via className is layout-only).

**`components/ask/deal-scope-notice.tsx`**:
`DealScopeNotice({ title, clearHref }: { title: string | null; clearHref: string })` — `Notice` with `action={<ButtonLink href={clearHref} variant="ghost" size="sm">Clear scope</ButtonLink>}`; children `title === null ? DEAL_NOT_FOUND_MESSAGE : \`Scoped to: ${title}\`` (one string so `getByText("Scoped to: Big deal")` works).

**`components/ask/example-questions.tsx`**:
`ExampleQuestions({ dealId }: { dealId: string | null })` — `Card` with `CardTitle` "Try asking" and a `<ul>` of `TextLink href={askHref({ question, dealId })}` for each `EXAMPLE_QUESTIONS` entry.

**`components/ask/answer-text.tsx`**:
`AnswerText({ answer, labels }: { answer: string; labels: ReadonlySet<string> })` — `<p className="text-sm whitespace-pre-line break-words text-foreground">` mapping `parseCitations` segments: text -> plain string child (React escapes it), citation -> `<TextLink href={\`#source-${label}\`}>{label}</TextLink>`. Keys by index. Comment: "Model output is untrusted: it is only ever rendered as text."

**`components/ask/answer-card.tsx`**: `AnswerCard({ answer, labels })` — `Card className="flex flex-col gap-3"` with `CardTitle` "Answer" and `AnswerText`.

**`components/ask/source-card.tsx`**:
`SourceCard({ source, cited }: { source: AskSource; cited: boolean })`
- `<Card id={\`source-${source.label}\`} highlighted={cited} className="flex flex-col gap-2 scroll-mt-6">` (scroll-mt is spacing/layout).
- Row 1: label (`text-sm font-medium`), `{cited && <Badge variant="accent">Cited</Badge>}`, `<Badge>{INTERACTION_TYPE_LABELS[source.type]}</Badge>`, `<time dateTime={source.occurredAt} className="text-xs text-muted">{formatDate(source.occurredAt)}</time>`.
- Row 2 (`text-sm text-muted`): `{source.companyName}` · `<TextLink href={\`/deals/${source.dealId}\`}>{source.dealTitle}</TextLink>`.
- Excerpt `<p className="text-sm whitespace-pre-line break-words text-foreground">`.
- `<RelevanceIndicator level={relevanceLevel(source.similarity)} />`.

**`components/ask/source-list.tsx`**:
`SourceList({ sources, citedIds }: { sources: AskSource[]; citedIds: ReadonlySet<string> })` — `<section className="flex flex-col gap-3">` with an `h2` "Sources" (`text-sm font-medium`), `<ol aria-label="Sources" className="flex flex-col gap-3">`, each `<li key={interactionId}><SourceCard cited={citedIds.has(interactionId)} /></li>`.

**`components/ask/ask-answer.tsx`** (sync):
`AskAnswer({ response }: { response: AskResponse })`
- `if (response.sources.length === 0) return <EmptyState title={ASK_NO_MATCHES_MESSAGE} />;`
- `labels = new Set(sources.map(s => s.label))`, `citedIds = new Set(citedInteractionIds)`.
- `showAnswer = answeredBy === "llm" && typeof answer === "string" && answer.trim() !== ""`.
- Render in order: `{answeredBy === "llm" && insufficientInformation && <Notice>{ASK_NO_CLEAR_ANSWER_MESSAGE}</Notice>}`, `{answeredBy === "none" && <Notice>{ASK_NO_AI_ANSWER_MESSAGE}</Notice>}`, `{showAnswer && <AnswerCard .../>}`, `<SourceList .../>`, in a `flex flex-col gap-6` div.
- No business rules: it only reads API flags.

**`components/ask/ask-results.tsx`** (async Server Component):
`AskResults({ question, dealId }: { question: string; dealId: string | null })`
- `const outcome = await runAsk(dealId === null ? { question } : { question, dealId });`
- `form = (props) => <AskForm question={question} dealId={dealId} {...props} />`
- unreachable: form + `<ApiUnavailable />`; invalid: form with `fieldError={outcome.fieldErrors.question}` and `formError={outcome.formError}`; searchStarting: form with `formError={ASK_SEARCH_STARTING_MESSAGE}`; dealMissing: form with `formError={DEAL_NOT_FOUND_MESSAGE}`; ok: form + `<AskAnswer response={outcome.data} />`.
- Wrapper `flex flex-col gap-6`. Use a `switch` on `outcome.status` with an exhaustive return.

**`components/ask/ask-skeleton.tsx`**:
- `AskResultsSkeleton()` — `<div role="status" aria-label="Searching the notes" className="flex flex-col gap-3">` with a `Skeleton` for the answer (`h-24 w-full`) and three for sources (`h-28 w-full`).
- `AskPending({ question, dealId })` — `<AskForm question dealId pending />` + `<AskResultsSkeleton />`.
- `AskPageSkeleton()` — `role="status" aria-label="Loading"` with skeletons for the form row and the examples card.

**`components/ask/ask-view.tsx`** (async; reads searchParams, so must be inside Suspense):
`AskView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> })`
1. `const { question, dealId } = parseAskParams(await searchParams);`
2. If `dealId !== null`: `const scope = await loadOptionalResource(getDeal(dealId));`
   - `unreachable` -> return `<ApiUnavailable />`.
   - `missing` -> return `<DealScopeNotice title={null} clearHref={askHref({ question })} />` only.
   - `ok` -> keep `deal.title` for the notice.
3. Render `flex flex-col gap-6`: scope notice (if scoped), then
   - `question === null`: `<AskForm dealId={dealId} />` + `<ExampleQuestions dealId={dealId} />`.
   - else: `<Suspense key={askHref({ question, dealId })} fallback={<AskPending question={question} dealId={dealId} />}><AskResults question={question} dealId={dealId} /></Suspense>`.
- Comment on the `key`: next/form navigates with `router.push` inside a transition, which would keep the old results on screen; a new key makes React treat it as a new boundary, so the fallback shows on every new question. `useFormStatus` does not work for a string-action `Form`.

**`app/ask/page.tsx`**:
```tsx
export const metadata: Metadata = { title: "Ask your CRM", robots: { index: false } };
export default function AskPage(props: PageProps<"/ask">) {
  return (<div className="flex flex-col gap-6 max-w-3xl">
    <PageHeader title="Ask your CRM" description="Answers come only from your interaction notes and cite their sources." />
    <Suspense fallback={<AskPageSkeleton />}><AskView searchParams={props.searchParams} /></Suspense>
  </div>);
}
```
(The header is static; searchParams are only read inside Suspense so the shell prerenders with Cache Components. Do not add route segment config such as `dynamic`.) `PageProps<"/ask">` is generated by Next typegen once the route exists; if typecheck runs before typegen, `next build`/`next typegen` regenerates it (same as other pages).

**`app/ask/loading.tsx`**: `PageHeader` (same title/description) + `AskPageSkeleton`, in the same wrapper.

**`app/ask/error.tsx`**: `"use client"`, same as `app/companies/error.tsx` (rename function to `AskError`).

**`components/deals/deal-view.tsx`**: in `PageHeader` `actions`, before "All deals": `<TextLink href={askHref({ dealId: id })} className="text-sm">Ask about this deal</TextLink>` (produces `/ask?dealId={id}`).

### Data flow

1. Browser submits `next/form` -> `router.push("/ask?q=...&dealId=...")`.
2. Server renders `app/ask/page.tsx`: static header; `AskView` (inside Suspense) awaits `searchParams` -> `parseAskParams`.
3. Scoped: `getDeal(dealId)` via `loadOptionalResource` -> ok (title) / missing (notice only, stop) / unreachable (stop).
4. No question: form + examples. Question: keyed Suspense shows `AskPending` while `AskResults` runs `runAsk` -> `askCrm` -> `POST {API_URL}/ask` with `{ question, dealId? }`.
5. `runAsk` maps the result/ApiError to `AskOutcome`; `AskResults` renders form (+errors) and `AskAnswer`.
6. `AskAnswer` -> notices, `AnswerCard` (`parseCitations` -> text + `#source-Sn` links), `SourceList` -> `SourceCard` (highlight from `citedInteractionIds`, relevance from `relevanceLevel(similarity)`).

### Sequencing

1. `lib/types.ts`, `lib/messages.ts`, `lib/form-state.ts` (`AskField`).
2. `lib/api.ts` (`askCrm`, `EMBEDDING_UNAVAILABLE`), `lib/load.ts` (`loadOptionalResource`).
3. `lib/ask-display.ts`, `lib/citations.ts`, `lib/ask.ts`.
4. `components/ui/card.tsx` (`highlighted`), `components/ui/relevance-indicator.tsx`.
5. Leaf components: `ask-form`, `deal-scope-notice`, `example-questions`, `answer-text`, `answer-card`, `source-card`, `source-list`, `ask-skeleton`.
6. `ask-answer`, `ask-results`, `ask-view`.
7. `app/ask/page.tsx`, `loading.tsx`, `error.tsx`.
8. `deal-view.tsx` link.
9. Tests; then web lint, typecheck, test, build; API lint, typecheck, tests.

### Tests (all in `web/tests/unit/`, mocked `@/lib/api`, never real fetch)

- `citations.test.ts`: `it.each` table for `parseCitations`: `[S1]`, `[S1, S2]`, `[S1,S2]`, `[ S1 , S2 ]`, `[S1][S3]`, `[S9]` unknown, `[S1, S9]` mixed, `[s1]`, `[S1 and S2]`, `[]`, no markers, empty answer; plus the round-trip invariant (joined output equals input).
- `ask-display.test.ts`: `parseAskParams` (absent, `""`, arrays, empty dealId), `askHref` (none -> `/ask`, q only, dealId only -> `/ask?dealId=d1`, both, special characters encoded), `relevanceLevel` table at the boundaries (0.75, 0.6, 0.59, 0.4, 0.39, 0.25).
- `ask.test.ts` (`runAsk`): ok; 400 with question detail -> `fieldErrors.question`; 400 with dealId detail -> `formError`; 404 -> dealMissing; 503 EMBEDDING_UNAVAILABLE -> searchStarting; 0 -> unreachable; 500 and 503 other code -> rejects.
- `api.test.ts` (extend): `askCrm` sends `POST {API_URL}/ask` with JSON body and `Content-Type: application/json`.
- `load.test.ts` (extend): `loadOptionalResource` 404 and 400 VALIDATION_ERROR -> missing (and `notFound` not called), 0 -> unreachable, 500 rethrown.
- `answer-text.test.tsx`: links for `[S1]` and `[S1, S2]` with correct hrefs and text content preserved; unknown `[S9]` no link; mixed group one link; `<script>alert(1)</script> <b>x</b>` rendered as text (`container.querySelector("script")` and `("b")` null, text present).
- `source-card.test.tsx`: fields (label, company, deal link href, "Email", date via `formatDate`, excerpt), id `source-S1`, cited -> "Cited" badge + `border-accent`, not cited -> none + `border-border`; relevance text and no `%`.
- `ask-answer.test.tsx`: the three answer states (llm normal, llm insufficient with DOM-order check via `compareDocumentPosition`, none), empty sources EmptyState only, cited highlighting via `citedInteractionIds`.
- `ask-results.test.tsx` (`render(await AskResults(...))`): calls `askCrm` with/without dealId (no `dealId` key when unscoped); field error next to field with aria attributes; 503 message; 404 message; unreachable hint; ok renders answer.
- `ask-view.test.tsx` (mock `@/components/ask/ask-results` with a stub rendering `question`/`dealId` as text): no question -> form + three example links with exact hrefs, `askCrm`/`getDeal` not called; scoped no question -> example hrefs include dealId, hidden input; valid scope with question -> "Scoped to: Big deal", clear link `/ask?q=...`, results stub receives dealId; `it.each` 404 / 400 VALIDATION_ERROR -> "This deal no longer exists.", clear link, no textbox, results stub not rendered, `notFound` not called (mock `next/navigation` like `deal-view.test.tsx`); getDeal unreachable -> "Cannot reach the API"; `dealId=""` -> `getDeal` not called.
- `ask-skeleton.test.tsx`: `AskPending` disabled textbox with value, disabled "Searching..." button, status "Searching the notes".
- `ask-page.test.tsx`: `metadata.robots` has `index: false`, title; shell heading "Ask your CRM" (mock `@/components/ask/ask-view`).
- `deal-view.test.tsx` (extend): link "Ask about this deal" href `/ask?dealId=d1`.
- `card.test.tsx` / `relevance-indicator.test.tsx`: `highlighted` class switch; meter `aria-valuenow`/`aria-valuetext` per level (`it.each`).
- Avoid duplicate coverage: marker edge cases live in `citations.test.ts`; the component test only proves wiring (one known, one unknown, one group, HTML-as-text).

### Conventions to follow

- Data fetched only in Server Components via `lib/api.ts`; `lib/ask.ts` imports `server-only`. No `fetch` in components; no browser API calls. No Server Action is needed (GET navigation, read-only).
- No business logic in the web: the API owns validation, the answer, citations and `insufficientInformation`. The relevance banding is display formatting only (like `stageBadgeVariant`), kept in `lib/ask-display.ts`.
- Pages built from `components/ui/` plus layout utilities; new visual pieces go into `components/ui/` (`RelevanceIndicator`, `Card.highlighted`). `className` on ui components only for layout.
- Colors only from tokens (`border-accent`, `bg-accent`, `bg-surface-hover`, `text-muted`, `text-foreground`, `text-danger` via `FormError`). State colors only for the error message.
- Request-time data inside `<Suspense>` with a fallback; searchParams only awaited inside Suspense.
- Never `dangerouslySetInnerHTML` for model output.
- Small components, explicit names, no `any`, strict TS. Comments explain why (match the existing comment style).
- Tests: behavior-named, `it.each` for variants, each test able to fail; `vi.mock("@/lib/api", async (importOriginal) => ...)` to keep `ApiError` real.
- English everywhere. Do not touch `api/` or `.claude/`. No git commands that change history. Suggested commit: `feat: add Ask your CRM page with cited answers and deal scope`.

## Open questions / assumptions

1. **Loading state mechanism.** `useFormStatus` does not track a string-action `next/form` (it preventDefaults and calls `router.push`). Assumption: the loading state is the keyed Suspense fallback (`AskPending`: disabled form with "Searching..." + skeleton) plus `app/ask/loading.tsx`. Re-submitting the identical URL shows no fallback (old results stay until replaced); accepted.
2. **Form placement.** API field errors must sit next to the field, but they are only known after `POST /ask`, so the form for a submitted question is rendered inside `AskResults` (and its disabled copy in the fallback). For the no-question state it is rendered directly by `AskView`.
3. **Empty/whitespace `q`** is sent to the API (so its message shows inline) rather than falling back to the examples; no HTML constraints on the input, so the API is the only validator.
4. **"Clear scope" keeps `q`.** Clearing re-runs the same question across all deals. For the invalid-deal state the same link is used.
5. **Invalid deal hides the form and examples** ("no search runs" read as: the page shows only the notice and the clear link). The page does not 404.
6. **Example links keep a valid scope** (`dealId` appended) so examples work inside a scoped page.
7. **Relevance bands** 0.6 / 0.4 are an assumption tuned for MiniLM cosine similarity (the API's floor is 0.25). Shown as High/Medium/Low, never as a number.
8. **Scope notice text** uses the existing `DEAL_NOT_FOUND_MESSAGE` ("This deal no longer exists." with a period) for consistency with the rest of the app.
9. **Marker links target any source**, not only cited ones; highlighting follows `citedInteractionIds` only. Unknown labels are plain text.
10. **Empty sources** show only the EmptyState, even for `answeredBy: "none"` (the "Showing the most relevant notes" notice would be misleading with no notes).
11. **`limit`** is not sent; the API default (5) is used.
12. **Deal title in the scope notice** is plain text (not a link) so the notice reads as one string; the deal is reachable from the source cards and the browser history.
