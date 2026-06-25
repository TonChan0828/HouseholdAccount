"use client";

import { useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { yen } from "@/lib/format";
import { recognizeReceipt } from "@/lib/receipt/ocr";
import { type ParsedReceipt, parseReceipt } from "@/lib/receipt/parse-receipt";

type Props = {
  /** OCR で抽出できた金額・日付（いずれか/両方が null になりうる）を受け取る。 */
  onResult: (result: ParsedReceipt) => void;
};

/**
 * レシート画像を選択してブラウザ内 OCR にかけ、抽出した金額・日付を親へ渡すボタン。
 * 画像は保存せず、認識後に破棄する。OCR 精度は限定的なため、結果は確認・修正前提。
 */
export function ReceiptScanButton({ onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルを連続選択しても change が発火するよう値をリセットする。
    e.target.value = "";
    if (!file) return;

    setScanning(true);
    setProgress(0);
    try {
      const text = await recognizeReceipt(file, setProgress);
      const result = parseReceipt(text);
      onResult(result);

      if (result.amount === null && result.date === null) {
        toast.warning("レシートから金額・日付を読み取れませんでした", {
          description: "手入力で登録してください",
        });
      } else {
        const parts: string[] = [];
        if (result.amount !== null) parts.push(yen(result.amount));
        if (result.date !== null) parts.push(result.date);
        toast.success("レシートを読み取りました", {
          description: `${parts.join(" / ")}（内容をご確認ください）`,
        });
      }
    } catch {
      toast.error("レシートの読み取りに失敗しました");
    } finally {
      setScanning(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFile}
        aria-hidden
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2 text-base"
        onClick={() => inputRef.current?.click()}
        disabled={scanning}
      >
        <ScanLine className="size-4" aria-hidden />
        {scanning
          ? `読み取り中… ${Math.round(progress * 100)}%`
          : "レシートを読み取る"}
      </Button>
    </div>
  );
}
