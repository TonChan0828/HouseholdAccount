import type { Metadata } from "next";

import { HelpAccordion } from "@/components/features/help/help-accordion";

export const metadata: Metadata = {
  title: "ヘルプ｜Shallet",
};

export default function HelpPage() {
  return (
    <main className="mx-auto w-full max-w-2xl animate-in space-y-4 p-4 duration-500 fade-in slide-in-from-bottom-2 sm:py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">ヘルプ</h1>
        <p className="text-sm text-muted-foreground">
          各画面の操作方法をまとめています。見たい項目をタップすると手順が開きます。
        </p>
      </div>

      <HelpAccordion />
    </main>
  );
}
