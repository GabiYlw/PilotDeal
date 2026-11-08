import { Comparison } from "@/components/sections/comparison";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Problem } from "@/components/sections/problem";
import { UnderTheHood } from "@/components/sections/under-the-hood";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Comparison />
      <UnderTheHood />
      <Faq />
      <FinalCta />
    </>
  );
}
