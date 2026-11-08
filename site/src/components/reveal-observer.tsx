"use client";

import { useEffect } from "react";

// Marks each [data-reveal] section with data-revealed the first time it scrolls into view; the
// fade itself is CSS in globals.css and only runs when the user has not asked for reduced motion.
// Renders nothing.
export function RevealObserver() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reveal = (element: Element) => element.setAttribute("data-revealed", "");
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach(reveal);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return null;
}
