import { HomePageContent } from "@/components/home-page";
import { DemoHomeStats } from "@/demo/components/demo-home";
import { DemoStatus } from "@/demo/components/demo-states";

export default function DemoHomePage() {
  return <HomePageContent status={<DemoStatus />} stats={<DemoHomeStats />} />;
}
