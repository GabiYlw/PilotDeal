import { Check } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/primitives";
import { comparison } from "@/content";

const TITLE_ID = "comparison-title";
const HEAD_CLASS = "px-5 py-3 text-left font-mono text-xs font-semibold tracking-wider uppercase";

export function Comparison() {
  const { columns } = comparison;
  return (
    <Section labelledBy={TITLE_ID}>
      <SectionHeading id={TITLE_ID} eyebrow={comparison.eyebrow} title={comparison.title} />
      {/* Wide content scrolls sideways inside this wrapper, never the page. */}
      <div className="mt-10 overflow-x-auto rounded-2xl border border-card-border bg-surface shadow-card">
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
                  <span className="flex gap-2">
                    <Check
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="mt-0.5 size-4 shrink-0 text-link"
                    />
                    {row.pilotDeal}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
