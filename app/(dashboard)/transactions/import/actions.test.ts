import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirmImport, parseImportFile } from "./actions";

const state = vi.hoisted(() => ({
  parseWorkbookCalls: 0,
  rpc: vi.fn(),
}));

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => ({
    user: { id: "u-1" },
    householdId: "h-1",
    supabase: { rpc: (...args: unknown[]) => state.rpc(...args) },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

vi.mock("@/lib/import/parse-workbook", () => ({
  parseWorkbook: async () => {
    state.parseWorkbookCalls += 1;
    return [];
  },
}));

function fileOfSize(bytes: number): File {
  const file = new File(["dummy"], "budget.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

function formDataWithFile(file: File): FormData {
  const formData = new FormData();
  formData.set("file", file);
  return formData;
}

beforeEach(() => {
  state.parseWorkbookCalls = 0;
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ error: null });
});

describe("parseImportFile", () => {
  it("ファイルサイズが上限（5MB）を超える場合はエラーを返し parseWorkbook を呼ばない", async () => {
    const result = await parseImportFile(
      undefined,
      formDataWithFile(fileOfSize(5 * 1024 * 1024 + 1)),
    );

    expect(result).toEqual({
      ok: false,
      error: "ファイルサイズが大きすぎます（5MB以内）",
    });
    expect(state.parseWorkbookCalls).toBe(0);
  });

  it("上限ちょうど（5MB）は許可され parseWorkbook を呼ぶ", async () => {
    const result = await parseImportFile(
      undefined,
      formDataWithFile(fileOfSize(5 * 1024 * 1024)),
    );

    expect(state.parseWorkbookCalls).toBe(1);
    expect(result).toEqual({
      ok: false,
      error: "取り込めるシートが見つかりませんでした",
    });
  });
});

describe("confirmImport", () => {
  function formDataWithRows(rows: unknown, month = "2026-06") {
    const formData = new FormData();
    formData.set("month", month);
    formData.set("rows", JSON.stringify(rows));
    return formData;
  }

  it("カテゴリと取引を1回のRPCで確定する", async () => {
    const formData = formDataWithRows([
      { type: "expense", categoryName: "食費", amount: 1200 },
    ]);

    await expect(confirmImport(undefined, formData)).rejects.toThrow(
      "NEXT_REDIRECT:/transactions?ref=2026-06-01",
    );
    expect(state.rpc).toHaveBeenCalledWith("confirm_transaction_import", {
      _household_id: "h-1",
      _month: "2026-06-01",
      _rows: [{ type: "expense", categoryName: "食費", amount: 1200 }],
    });
  });

  it("RPC失敗時は完了画面へ遷移しない", async () => {
    state.rpc.mockResolvedValue({ error: new Error("database failure") });

    await expect(
      confirmImport(
        undefined,
        formDataWithRows([
          { type: "expense", categoryName: "食費", amount: 1200 },
        ]),
      ),
    ).resolves.toEqual({ error: "収支の取り込みに失敗しました" });
    expect(state.rpc).toHaveBeenCalledOnce();
  });

  it("DB integer上限を超える金額はRPC前に拒否する", async () => {
    await expect(
      confirmImport(
        undefined,
        formDataWithRows([
          { type: "expense", categoryName: "食費", amount: 2_147_483_648 },
        ]),
      ),
    ).resolves.toEqual({ error: "取り込む内容を確認してください" });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
