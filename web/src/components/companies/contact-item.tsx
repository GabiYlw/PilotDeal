"use client";

import { useEffect, useRef, useState } from "react";
import { type ContactAction, ContactForm } from "@/components/companies/contact-form";
import { DeleteContactButton } from "@/components/companies/delete-contact-button";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/form-state";
import type { Contact } from "@/lib/types";

export type RemoveContactAction = (state: ActionState) => Promise<ActionState>;

export function ContactItem({
  contact,
  edit,
  remove,
}: {
  contact: Contact;
  edit: ContactAction;
  remove: RemoveContactAction;
}) {
  const [editing, setEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusToEdit = useRef(false);

  // The Edit button only exists again after the form has closed, so focus moves in an effect.
  useEffect(() => {
    if (!editing && returnFocusToEdit.current) {
      returnFocusToEdit.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  function closeEditor() {
    returnFocusToEdit.current = true;
    setEditing(false);
  }

  if (editing) {
    return (
      <ContactForm
        action={edit}
        defaults={{
          name: contact.name,
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          role: contact.role ?? "",
        }}
        idPrefix={`contact-${contact.id}`}
        ariaLabel="Edit contact"
        submitLabel="Save"
        pendingLabel="Saving..."
        onCancel={closeEditor}
        onSaved={closeEditor}
        autoFocus
      />
    );
  }

  const summaryId = `contact-${contact.id}-summary`;
  const details = [contact.role, contact.email, contact.phone].filter(
    (value): value is string => value !== null,
  );
  return (
    <>
      <div id={summaryId} className="flex flex-col gap-0.5">
        <span className="text-sm font-medium [overflow-wrap:anywhere] text-foreground">
          {contact.name}
        </span>
        {details.map((detail, index) => (
          <span key={index} className="text-sm [overflow-wrap:anywhere] text-muted">
            {detail}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Button
          ref={editButtonRef}
          variant="ghost"
          size="sm"
          aria-describedby={summaryId}
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
        <DeleteContactButton action={remove} contactName={contact.name} describedBy={summaryId} />
      </div>
    </>
  );
}
