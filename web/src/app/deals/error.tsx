"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { API_NOT_RUNNING_MESSAGE } from "@/lib/messages";

// Production redacts the error message, so this cannot tell why it failed. The API being down is
// the most likely cause, so the hint says so.
export default function DealsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      title="Something went wrong"
      description={`This page could not be loaded. ${API_NOT_RUNNING_MESSAGE}`}
      action={<Button onClick={() => retry()}>Try again</Button>}
    />
  );
}
