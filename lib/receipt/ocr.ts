// Tesseract.js（WASM 版 Tesseract）をブラウザ内で実行し、レシート画像から日本語テキストを
// 認識する薄いラッパー。LLM もサーバーも使わず完全クライアントサイドで動く。
// tesseract.js は重い（WASM＋言語データ）ため、関数内で動的 import してメインバンドルから切り離す。
// jpn.traineddata は初回のみ CDN から取得され、以降は IndexedDB にキャッシュされる。

/** 認識の進捗（0〜1）を受け取るコールバック。 */
export type OcrProgress = (progress: number) => void;

// 巨大なスマホ写真は認識が遅くなるため、長辺をこのサイズまで縮小してから認識する。
const MAX_DIMENSION = 2000;

/** 画像が大きすぎる場合のみ canvas で縮小し、Blob を返す。失敗時は元の File を返す。 */
async function downscaleIfNeeded(file: File): Promise<Blob> {
  if (typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest <= MAX_DIMENSION) {
      bitmap.close();
      return file;
    }
    const scale = MAX_DIMENSION / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * レシート画像を OCR して生テキストを返す。
 * @param file 画像ファイル
 * @param onProgress 認識進捗（0〜1）
 */
export async function recognizeReceipt(
  file: File,
  onProgress?: OcrProgress,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const image = await downscaleIfNeeded(file);

  const worker = await createWorker("jpn", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(image);
    return text;
  } finally {
    await worker.terminate();
  }
}
