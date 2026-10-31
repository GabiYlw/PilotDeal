import type { Contact, Deal, Interaction } from "./types";

// 32-bit FNV-1a: a short stable fingerprint, so the Client Component gets a few characters
// instead of every id and timestamp on the page.
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

// Changes whenever the data on the deal page changes: the deal itself (a stage update changes
// updatedAt), or the interactions (an add or delete changes the total and the ids, an edit
// changes that interaction's updatedAt). The add form uses it to know when its "Interaction
// added." message is out of date.
export function pageVersion(
  deal: Pick<Deal, "updatedAt">,
  interactions: readonly Pick<Interaction, "id" | "updatedAt">[],
  total: number,
): string {
  return fingerprint([deal.updatedAt, total, ...stamps(interactions)].join("|"));
}

// The same for the Contacts card: an add or delete changes the total and the ids, an edit changes
// that contact's updatedAt. The add form uses it for its "Contact added." message.
export function contactsVersion(
  contacts: readonly Pick<Contact, "id" | "updatedAt">[],
  total: number,
): string {
  return fingerprint([total, ...stamps(contacts)].join("|"));
}

function stamps(items: readonly { id: string; updatedAt: string }[]): string[] {
  return items.map((item) => `${item.id}@${item.updatedAt}`);
}
