import type { Metadata } from "next";

import { HelpAccordion } from "@/components/features/help/help-accordion";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "ヘルプ｜Shallet",
};

export default function HelpPage() {
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 p-4 sm:py-8">
      <div className={reveal}>
        <PageHeader eyebrow="サポート" title="ヘルプ" />
        <p className="mt-2 text-sm text-muted-foreground">
          各画面の操作方法をまとめています。見たい項目をタップすると手順が開きます。
        </p>
      </div>

      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <HelpAccordion />
      </div>
    </main>
  );
}
