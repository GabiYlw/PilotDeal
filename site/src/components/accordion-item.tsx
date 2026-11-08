"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

// One item of the WAI-ARIA accordion pattern: a heading holding a button that shows or hides
// its panel. Items open independently, and Tab moves between the buttons.
export function AccordionItem({ question, children }: { question: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const buttonId = `${id}-button`;
  const panelId = `${id}-panel`;
  return (
    <div className="border-b border-border last:border-b-0">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold text-foreground"
        >
          {question}
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.75}
            className={`size-5 shrink-0 text-link transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="pb-5 text-sm text-muted"
      >
        {children}
      </div>
    </div>
  );
}
