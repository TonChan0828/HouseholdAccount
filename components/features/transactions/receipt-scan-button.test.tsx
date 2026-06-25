import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReceiptScanButton } from "./receipt-scan-button";

// OCR 本体（Tesseract.js）は jsdom で動かさず、canned テキストに差し替える。
const recognizeReceipt = vi.fn();
vi.mock("@/lib/receipt/ocr", () => ({
  recognizeReceipt: (...args: unknown[]) => recognizeReceipt(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

function pickFile() {
  return new File(["dummy"], "receipt.png", { type: "image/png" });
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

describe("ReceiptScanButton", () => {
  beforeEach(() => {
    recognizeReceipt.mockReset();
  });

  it("OCRテキストから抽出した金額・日付を onResult へ渡す", async () => {
    recognizeReceipt.mockResolvedValue("合計 ¥1,320\n2024/01/15");
    const onResult = vi.fn();
    const { container } = render(<ReceiptScanButton onResult={onResult} />);

    await userEvent.upload(fileInput(container), pickFile());

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({
        amount: 1320,
        date: "2024-01-15",
      }),
    );
  });

  it("読み取れなかった場合も onResult(null,null) を渡す", async () => {
    recognizeReceipt.mockResolvedValue("ありがとうございました");
    const onResult = vi.fn();
    const { container } = render(<ReceiptScanButton onResult={onResult} />);

    await userEvent.upload(fileInput(container), pickFile());

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({ amount: null, date: null }),
    );
  });

  it("OCR が例外を投げても onResult は呼ばれない", async () => {
    recognizeReceipt.mockRejectedValue(new Error("boom"));
    const onResult = vi.fn();
    const { container } = render(<ReceiptScanButton onResult={onResult} />);

    await userEvent.upload(fileInput(container), pickFile());

    await waitFor(() => expect(recognizeReceipt).toHaveBeenCalled());
    expect(onResult).not.toHaveBeenCalled();
  });
});
