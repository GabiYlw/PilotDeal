import type { RichText as RichTextData } from "@/content";
import { SmartLink } from "./ui/smart-link";

const LINK_CLASS = "font-medium text-link underline underline-offset-4 hover:no-underline";

export function RichText({ text }: { text: RichTextData }) {
  return (
    <>
      {text.map((part, index) =>
        typeof part === "string" ? (
          part
        ) : (
          <SmartLink key={index} link={part} className={LINK_CLASS} />
        ),
      )}
    </>
  );
}
