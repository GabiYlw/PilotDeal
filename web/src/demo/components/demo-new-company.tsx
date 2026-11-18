"use client";

import { CompanyForm } from "@/components/companies/company-form";
import { addCompany } from "../actions";

// The New client form with the demo's action. A Client Component, because a Server Component page
// can pass a Server Action to a form but not a plain browser function.
export function DemoNewCompanyForm() {
  return (
    <CompanyForm
      action={addCompany}
      idPrefix="company"
      ariaLabel="New client"
      submitLabel="Create client"
      pendingLabel="Creating..."
      cancelHref="/clients"
      autoFocus
    />
  );
}
