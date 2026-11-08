import { Comparison } from "@/components/sections/comparison";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Problem } from "@/components/sections/problem";
import { WhyPilotDeal } from "@/components/sections/why-pilotdeal";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Comparison />
      <WhyPilotDeal />
      <Faq />
      <FinalCta />
    </>
  );
}
