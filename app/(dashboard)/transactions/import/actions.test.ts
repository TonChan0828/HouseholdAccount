import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseImportFile } from "./actions";

const state = vi.hoisted(() => ({
  parseWorkbookCalls: 0,
}));

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => ({
    user: { id: "u-1" },
    householdId: "h-1",
    supabase: {},
  }),
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
