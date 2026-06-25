"use client";

import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";

/**
 * Tesseract.js（重い WASM＋言語データ）を含む ReceiptScanButton を遅延ロードするラッパー。
 * ボタンを描画するまで OCR ライブラリをバンドル・取得しない。
 */
export const ReceiptScanButton = dynamic(
  () => import("./receipt-scan-button").then((m) => m.ReceiptScanButton),
  {
    ssr: false,
    loading: () => (
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2 text-base"
        disabled
      >
        レシート読み取りを準備中…
      </Button>
    ),
  },
);
