"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HELP_SECTIONS } from "@/components/features/help/help-content";

/** 各画面の操作ガイドをアコーディオンで表示する。 */
export function HelpAccordion() {
  return (
    <Accordion multiple={false} className="rounded-xl border bg-card px-4 shadow-soft">
      {HELP_SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger>
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {section.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-3 text-muted-foreground">{section.description}</p>
              <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                {section.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
