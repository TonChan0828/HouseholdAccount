import { beforeEach, describe, expect, it, vi } from "vitest";

import { getHouseholdMemberNames } from "./members";

const state = vi.hoisted(() => ({
  members: [] as {
    household_id: string;
    user_id: string;
    display_name: string | null;
    joined_at: string;
  }[],
  profiles: [] as { id: string; display_name: string | null }[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const filters: { eq?: [string, string]; in?: [string, string[]] } = {};
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          filters.eq = [column, value];
          return query;
        },
        in: (column: string, values: string[]) => {
          filters.in = [column, values];
          return Promise.resolve({
            data: state.profiles.filter((p) => values.includes(p.id)),
            error: null,
          });
        },
        order: () =>
          Promise.resolve({
            data: state.members
              .filter((m) => m.household_id === filters.eq?.[1])
              .sort((a, b) => a.joined_at.localeCompare(b.joined_at)),
            error: null,
          }),
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  state.members = [
    {
      household_id: "h-1",
      user_id: "u-2",
      display_name: null,
      joined_at: "2026-02-01",
    },
    {
      household_id: "h-1",
      user_id: "u-1",
      display_name: "グループ名A",
      joined_at: "2026-01-01",
    },
    {
      household_id: "h-1",
      user_id: "u-3",
      display_name: null,
      joined_at: "2026-03-01",
    },
    {
      household_id: "h-2",
      user_id: "u-9",
      display_name: "別グループ",
      joined_at: "2026-01-01",
    },
  ];
  state.profiles = [
    { id: "u-1", display_name: "グローバル名A" },
    { id: "u-2", display_name: "グローバル名B" },
  ];
});

describe("getHouseholdMemberNames", () => {
  it("グループ毎の display_name を優先し、参加日時の昇順で返す", async () => {
    const members = await getHouseholdMemberNames("h-1");

    expect(members.map((m) => m.user_id)).toEqual(["u-1", "u-2", "u-3"]);
    expect(members[0]).toEqual({
      user_id: "u-1",
      display_name: "グループ名A",
    });
  });

  it("グループ毎の名前が未設定ならグローバル名にフォールバックする", async () => {
    const members = await getHouseholdMemberNames("h-1");

    expect(members[1]).toEqual({
      user_id: "u-2",
      display_name: "グローバル名B",
    });
  });

  it("どちらも無ければ「不明なユーザー」を返す", async () => {
    const members = await getHouseholdMemberNames("h-1");

    expect(members[2]).toEqual({
      user_id: "u-3",
      display_name: "不明なユーザー",
    });
  });

  it("指定した household のメンバーのみ返す", async () => {
    const members = await getHouseholdMemberNames("h-1");

    expect(members.some((m) => m.user_id === "u-9")).toBe(false);
  });
});
