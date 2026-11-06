"use client";

import { useEffect, useRef, useState } from "react";
import { type CompanyAction, CompanyForm } from "@/components/companies/company-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionItem, DescriptionList } from "@/components/ui/description-list";
import { MutedText } from "@/components/ui/muted-text";
import { TextLink } from "@/components/ui/text-link";
import { formatDate } from "@/lib/format";
import type { Company } from "@/lib/types";

// The form is mounted only while editing, so every opening starts from the saved values.
export function CompanyDetails({ company, action }: { company: Company; action: CompanyAction }) {
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

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader
        title="Details"
        actions={
          !editing && (
            <Button
              ref={editButtonRef}
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )
        }
      />
      {editing ? (
        <CompanyForm
          action={action}
          defaults={{
            name: company.name,
            industry: company.industry ?? "",
            website: company.website ?? "",
          }}
          idPrefix="company-edit"
          ariaLabel="Edit company"
          submitLabel="Save"
          pendingLabel="Saving..."
          onCancel={closeEditor}
          onSaved={closeEditor}
          autoFocus
        />
      ) : (
        <DescriptionList>
          <DescriptionItem term="Industry">{company.industry ?? <MutedText />}</DescriptionItem>
          <DescriptionItem term="Website">
            {company.website ? (
              <TextLink href={company.website} target="_blank" rel="noopener noreferrer">
                {company.website}
              </TextLink>
            ) : (
              <MutedText />
            )}
          </DescriptionItem>
          <DescriptionItem term="Created">{formatDate(company.createdAt)}</DescriptionItem>
        </DescriptionList>
      )}
    </Card>
  );
}
