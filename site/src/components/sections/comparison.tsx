import { Check } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/primitives";
import { comparison } from "@/content";

const TITLE_ID = "comparison-title";
const HEAD_CLASS = "px-5 py-3 text-left font-mono text-xs font-semibold tracking-wider uppercase";
const LABEL_CLASS = "font-mono text-xs font-semibold tracking-wider uppercase";

function PilotDealValue({ text }: { text: string }) {
  return (
    <span className="flex gap-2">
      <Check aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-link" />
      {text}
    </span>
  );
}

// Phone layout: one block per question, both answers stacked as label and value, so nothing
// scrolls sideways. Only one of the list and the table is displayed at a time.
function ComparisonList() {
  const { columns } = comparison;
  return (
    <ul
      aria-label={comparison.caption}
      className="mt-10 divide-y divide-border rounded-2xl border border-card-border bg-surface shadow-card md:hidden"
    >
      {comparison.rows.map((row) => (
        <li key={row.topic} className="flex flex-col gap-3 px-5 py-4">
          <p className="font-mono text-xs font-medium text-foreground">{row.topic}</p>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <dt className={`${LABEL_CLASS} text-muted`}>{columns.typical}</dt>
              <dd className="text-muted">{row.typical}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className={`${LABEL_CLASS} text-link`}>{columns.pilotDeal}</dt>
              <dd className="text-foreground">
                <PilotDealValue text={row.pilotDeal} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function ComparisonTable() {
  const { columns } = comparison;
  return (
    <div className="mt-10 hidden overflow-x-auto rounded-2xl border border-card-border bg-surface shadow-card md:block">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">{comparison.caption}</caption>
        <thead className="bg-canvas">
          <tr>
            <th scope="col" className={`${HEAD_CLASS} text-muted`}>
              {columns.topic}
            </th>
            <th scope="col" className={`${HEAD_CLASS} text-muted`}>
              {columns.typical}
            </th>
            <th scope="col" className={`${HEAD_CLASS} text-link`}>
              {columns.pilotDeal}
            </th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.topic} className="border-t border-border align-top">
              <th
                scope="row"
                className="w-1/4 px-5 py-4 text-left font-mono text-xs font-medium text-foreground"
              >
                {row.topic}
              </th>
              <td className="w-1/4 px-5 py-4 text-muted">{row.typical}</td>
              <td className="px-5 py-4 text-foreground">
                <PilotDealValue text={row.pilotDeal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A stacked list below md, the table from md up.
export function Comparison() {
  return (
    <Section labelledBy={TITLE_ID}>
      <SectionHeading id={TITLE_ID} eyebrow={comparison.eyebrow} title={comparison.title} />
      <ComparisonList />
      <ComparisonTable />
    </Section>
  );
}
