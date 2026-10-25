import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSettlement, deleteSettlement } from "./actions";

const state = vi.hoisted(() => ({
  householdId: "h-1" as string | null,
  rpc: vi.fn(),
  deleteFilters: {} as Record<string, string>,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => {
    if (!state.householdId) throw new Error("NEXT_REDIRECT:/households");
    const query = {
      delete: () => query,
      eq: (key: string, value: string) => { state.deleteFilters[key] = value; return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return { householdId: state.householdId, supabase: { rpc: state.rpc, from: () => query } };
  },
}));
beforeEach(() => {
  state.householdId = "h-1";
  state.rpc.mockReset().mockResolvedValue({ data: "settlement-id", error: null });
  state.deleteFilters = {};
});
function form(ref = "2026-07-01") { const f = new FormData(); f.set("ref", ref); return f; }

describe("createSettlement", () => {
  it("対象グループと日付だけを送り、計算結果や操作者を入力から受け取らない", async () => {
    const f = form(); f.set("snapshot", '{"total":1}'); f.set("settled_by", "other");
    expect(await createSettlement(undefined, f)).toBeUndefined();
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("create_settlement", { _household_id: "h-1", _ref: "2026-07-01" });
  });
  it.each([
    ["23505", "duplicate", "すでに精算済みです"],
    ["P0001", "settlement_members_required", "精算にはメンバーが2人以上必要です"],
    ["P0001", "settlement_no_expenses", "この期間に精算対象の支出はありません"],
    ["42501", "private details", "精算の記録に失敗しました"],
  ])("DBの失敗を安全なエラーに変換する: %s %s", async (code, message, expected) => {
    state.rpc.mockResolvedValue({ data: null, error: { code, message } });
    expect(await createSettlement(undefined, form())).toEqual({ error: expected });
  });
  it("グループ未選択では呼び出さない", async () => {
    state.householdId = null;
    await expect(createSettlement(undefined, form())).rejects.toThrow("NEXT_REDIRECT:/households");
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("存在しない月を拒否する", async () => {
    expect(await createSettlement(undefined, form("2026-99-01"))).toEqual({ error: "対象期間が不正です" });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
describe("deleteSettlement", () => {
  it("idと現在のグループで削除を絞る", async () => {
    const f = new FormData(); f.set("id", "s-1");
    await deleteSettlement(f);
    expect(state.deleteFilters).toEqual({ id: "s-1", household_id: "h-1" });
  });
  it("idがなければ削除しない", async () => {
    await deleteSettlement(new FormData());
    expect(state.deleteFilters).toEqual({});
  });
});
