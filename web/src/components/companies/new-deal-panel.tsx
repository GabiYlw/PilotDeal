"use client";

import { useEffect, useRef, useState } from "react";
import { type CreateDealAction, DealCreateForm } from "@/components/companies/deal-create-form";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";

// The Deals card title with a toggle for the inline create form. The form is mounted only while
// open, so every opening starts empty.
export function NewDealPanel({ action }: { action: CreateDealAction }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // The button is hidden while the form is open, so focus returns to it in an effect.
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  function close() {
    returnFocus.current = true;
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Deals</CardTitle>
        {!open && (
          <Button
            ref={buttonRef}
            variant="secondary"
            size="sm"
            aria-expanded={false}
            onClick={() => setOpen(true)}
          >
            New deal
          </Button>
        )}
      </div>
      {open && <DealCreateForm action={action} onCancel={close} />}
    </div>
  );
}
