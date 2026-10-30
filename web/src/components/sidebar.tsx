import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/deals", label: "Deals" },
  { href: "/companies", label: "Companies" },
  { href: "/ask", label: "Ask" },
] as const;

export function Sidebar() {
  return (
    <aside className="border-b border-slate-200 bg-white md:w-56 md:shrink-0 md:border-r md:border-b-0">
      <div className="px-5 py-4 text-lg font-semibold text-slate-900">PilotDeal</div>
      <nav aria-label="Main">
        <ul className="flex gap-1 px-3 pb-3 md:flex-col">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
