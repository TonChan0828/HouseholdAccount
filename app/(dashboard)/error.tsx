"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Surface } from "@/components/shared/surface";

export default function DashboardError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 items-center p-4 sm:py-8">
      <Surface variant="raised" className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-bold">
              データを読み込めませんでした
            </h1>
            <p className="text-sm text-muted-foreground">
              一時的な問題の可能性があります。時間をおいて再度お試しください。
            </p>
          </div>
          <Button type="button" onClick={unstable_retry}>
            <RotateCcw className="size-4" aria-hidden />
            もう一度試す
          </Button>
        </CardContent>
      </Surface>
    </main>
  );
}
