"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { header } from "@/content";
import { ButtonLink } from "./ui/button-link";

const PANEL_ID = "mobile-menu";

// The phone menu: a button that opens the anchor links (and the demo link) below the header.
// Escape closes it and returns focus to the button; choosing a link closes it too.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);
  const Icon = open ? X : Menu;

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? header.menuClose : header.menuOpen}
        onClick={() => setOpen((value) => !value)}
        className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors duration-150 hover:border-accent motion-reduce:transition-none"
      >
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </button>
      <div
        id={PANEL_ID}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-card-border bg-surface shadow-raised"
      >
        <nav aria-label={header.navLabel} className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
          <ul className="flex flex-col">
            {header.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={close}
                  className="block rounded-md px-2 py-3 text-sm font-medium text-foreground hover:bg-surface-hover"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <ButtonLink link={header.cta} onClick={close} className="mt-2 mb-1 w-full sm:hidden" />
        </nav>
      </div>
    </div>
  );
}
