import Link from "next/link";

// Deals, Companies and Ask are linked from the sidebar before they exist, so this page says so.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-slate-600">This page does not exist or has not been built yet.</p>
      <Link href="/" className="text-sm font-medium text-indigo-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
