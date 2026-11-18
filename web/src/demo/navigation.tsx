"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The real app's Server Actions end with redirect() (to a new deal, or to the list after a
// delete). Demo actions run in the browser, where redirect() only works while rendering, so they
// navigate with the router instead. DemoRouterBridge, mounted once in the demo layout, hands the
// router to them.

type Navigate = (href: string, options: { replace: boolean }) => void;

let navigateWith: Navigate | null = null;

export function navigate(href: string, { replace = false }: { replace?: boolean } = {}): void {
  navigateWith?.(href, { replace });
}

export function DemoRouterBridge() {
  const router = useRouter();
  useEffect(() => {
    navigateWith = (href, { replace }) => (replace ? router.replace(href) : router.push(href));
    return () => {
      navigateWith = null;
    };
  }, [router]);
  return null;
}
