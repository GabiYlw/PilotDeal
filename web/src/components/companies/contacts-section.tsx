import { type ContactAction, ContactForm } from "@/components/companies/contact-form";
import { ContactItem, type RemoveContactAction } from "@/components/companies/contact-item";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { contactsVersion } from "@/lib/page-version";
import type { Contact } from "@/lib/types";

export interface ContactItemActions {
  edit: ContactAction;
  remove: RemoveContactAction;
}

export function ContactsSection({
  contacts,
  total,
  addAction,
  actionsFor,
}: {
  contacts: Contact[];
  total: number;
  addAction: ContactAction;
  // Binds the Server Actions for one contact. Called on the server, so client components never
  // import the actions file.
  actionsFor: (contact: Contact) => ContactItemActions;
}) {
  return (
    <Card className="flex flex-col gap-5">
      <CardTitle>Contacts</CardTitle>
      <ContactForm
        action={addAction}
        idPrefix="contact"
        ariaLabel="Add contact"
        submitLabel="Add contact"
        pendingLabel="Adding..."
        pageVersion={contactsVersion(contacts, total)}
      />
      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" />
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-4">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-col gap-1.5 border-b border-border pb-4 last:border-b-0 last:pb-0"
              >
                <ContactItem contact={contact} {...actionsFor(contact)} />
              </li>
            ))}
          </ul>
          {total > contacts.length && (
            <p className="text-sm text-muted">
              Showing the {contacts.length} most recent of {total} contacts.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
