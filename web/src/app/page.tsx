import { Suspense } from "react";
import { HealthStatus } from "@/components/health-status";
import { HomePageContent } from "@/components/home-page";
import { HomeStats, HomeStatsSkeleton } from "@/components/home-stats";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <HomePageContent
      status={
        <Suspense fallback={<Badge variant="neutral">Checking API status...</Badge>}>
          <HealthStatus />
        </Suspense>
      }
      stats={
        <Suspense fallback={<HomeStatsSkeleton />}>
          <HomeStats />
        </Suspense>
      }
    />
  );
}
