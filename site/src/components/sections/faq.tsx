import { AccordionItem } from "@/components/accordion-item";
import { RichText } from "@/components/rich-text";
import { Card, Section, SectionHeading } from "@/components/ui/primitives";
import { faq } from "@/content";

const TITLE_ID = "faq-title";

export function Faq() {
  return (
    <Section id={faq.id} labelledBy={TITLE_ID} className="bg-surface">
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
        <SectionHeading id={TITLE_ID} eyebrow={faq.eyebrow} title={faq.title} />
        <Card className="py-1 lg:col-span-2">
          {faq.items.map((item) => (
            <AccordionItem key={item.question} question={item.question}>
              <p>
                <RichText text={item.answer} />
              </p>
            </AccordionItem>
          ))}
        </Card>
      </div>
    </Section>
  );
}
