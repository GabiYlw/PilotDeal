import { EmptyState } from "@/components/ui/empty-state";
import { API_NOT_RUNNING_MESSAGE } from "@/lib/messages";

export function ApiUnavailable() {
  return (
    <div role="alert">
      <EmptyState title="Cannot reach the API" description={API_NOT_RUNNING_MESSAGE} />
    </div>
  );
}
