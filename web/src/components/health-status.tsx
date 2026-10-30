import { ApiError, getHealth } from "@/lib/api";
import { type ApiHealth, HealthBadge } from "./health-badge";

async function checkHealth(): Promise<ApiHealth> {
  try {
    const health = await getHealth();
    return { api: "up", database: health.database };
  } catch (error) {
    // Any API failure means the badge shows "down"; a config error such as a missing API_URL still throws.
    if (error instanceof ApiError) {
      return { api: "down" };
    }
    throw error;
  }
}

// Server Component: fetches on every request. Render it inside <Suspense>.
export async function HealthStatus() {
  return <HealthBadge health={await checkHealth()} />;
}
