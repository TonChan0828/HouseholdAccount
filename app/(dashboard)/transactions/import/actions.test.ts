import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirmImport, parseImportFile } from "./actions";

const state = vi.hoisted(() => ({
  parseWorkbookCalls: 0,
  rpc: vi.fn(),
  rateLimit: "allowed" as "allowed" | "limited" | "unavailable",
}));

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => ({
    user: { id: "u-1" },
    householdId: "h-1",
    supabase: { rpc: (...args: unknown[]) => state.rpc(...args) },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimitWithReset: async () => ({ status: state.rateLimit }),
  RATE_LIMIT_UNAVAILABLE_MESSAGE: "一時的に利用できません",
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
  state.rateLimit = "allowed";
  state.parseWorkbookCalls = 0;
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ data: 1, error: null });
});

describe("parseImportFile", () => {
  it.each(["limited", "unavailable"] as const)("制限の判定が%sなら解析しない", async (status) => {
    state.rateLimit = status;
    expect(await parseImportFile(undefined, formDataWithFile(fileOfSize(100)))).toMatchObject({ ok: false });
    expect(state.parseWorkbookCalls).toBe(0);
  });
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
      "NEXT_REDIRECT:/transactions?ref=2026-06-01&imported=1&duplicates=0",
    );
    expect(state.rpc).toHaveBeenCalledWith("confirm_transaction_import_v2", {
      _household_id: "h-1",
      _month: "2026-06-01",
      _member_id: null,
      _rows: [{ type: "expense", categoryName: "食費", amount: 1200 }],
    });
  });

  it("一部だけ重複した取込は新規件数とスキップ数を表示する", async () => {
    state.rpc.mockResolvedValue({ data: 1, error: null });
    const formData = formDataWithRows([
      { type: "expense", categoryName: "食費", amount: 1200 },
      { type: "expense", categoryName: "日用品", amount: 800 },
    ]);

    await expect(confirmImport(undefined, formData)).rejects.toThrow(
      "NEXT_REDIRECT:/transactions?ref=2026-06-01&imported=1&duplicates=1",
    );
  });

  it("RPC失敗時は完了画面へ遷移しない", async () => {
    state.rpc.mockResolvedValue({ data: null, error: new Error("database failure") });

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

  it("調整行と明示日付、選択された名義人をDBに渡す", async () => {
    const member = "22222222-2222-4222-8222-222222222222";
    const rows = [{ type: "expense", categoryName: "調整", amount: -3500, date: "2024-02-29" }];
    const data = formDataWithRows(rows);
    data.set("member", member);
    await expect(confirmImport(undefined, data)).rejects.toThrow("NEXT_REDIRECT:");
    expect(state.rpc).toHaveBeenCalledWith("confirm_transaction_import_v2", {
      _household_id: "h-1", _month: "2026-06-01", _rows: rows, _member_id: member,
    });
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
