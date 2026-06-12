import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getActiveHouseholdId, setActiveHouseholdCookie } from "./household";

type MemberRow = { user_id: string; household_id: string; joined_at: string };

const state = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  user: null as { id: string } | null,
  members: [] as { user_id: string; household_id: string; joined_at: string }[],
  setCalls: [] as { name: string; value: string; options: Record<string, unknown> }[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "active_household_id" && state.cookieValue !== undefined
        ? { name, value: state.cookieValue }
        : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      state.setCalls.push({ name, value, options });
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
    from: () => {
      const filters: Record<string, string> = {};
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          filters[column] = value;
          return query;
        },
        order: () => query,
        limit: () => query,
        maybeSingle: async () => {
          const rows = state.members
            .filter((row) =>
              Object.entries(filters).every(
                ([key, value]) => row[key as keyof MemberRow] === value,
              ),
            )
            .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
          return { data: rows[0] ?? null, error: null };
        },
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  state.cookieValue = undefined;
  state.user = { id: "user-1" };
  state.members = [
    { user_id: "user-1", household_id: "h-old", joined_at: "2026-01-01" },
    { user_id: "user-1", household_id: "h-new", joined_at: "2026-06-01" },
    { user_id: "user-2", household_id: "h-other", joined_at: "2026-03-01" },
  ];
  state.setCalls = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getActiveHouseholdId", () => {
  it("Cookie が所属グループを指す場合はその ID を返す", async () => {
    state.cookieValue = "h-new";

    expect(await getActiveHouseholdId()).toBe("h-new");
  });

  it("Cookie が非所属グループを指す場合は無視して最古の参加グループを返す", async () => {
    state.cookieValue = "h-other";

    expect(await getActiveHouseholdId()).toBe("h-old");
  });

  it("Cookie が無い場合は最古の参加グループを返す", async () => {
    expect(await getActiveHouseholdId()).toBe("h-old");
  });

  it("未ログインの場合は Cookie があっても null を返す", async () => {
    state.user = null;
    state.cookieValue = "h-new";

    expect(await getActiveHouseholdId()).toBeNull();
  });

  it("どのグループにも所属していない場合は null を返す", async () => {
    state.members = [];

    expect(await getActiveHouseholdId()).toBeNull();
  });
});

describe("setActiveHouseholdCookie", () => {
  it("本番環境では secure フラグ付きで Cookie を設定する", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await setActiveHouseholdCookie("h-new");

    expect(state.setCalls).toHaveLength(1);
    expect(state.setCalls[0]).toMatchObject({
      name: "active_household_id",
      value: "h-new",
      options: { httpOnly: true, sameSite: "lax", secure: true },
    });
  });

  it("開発環境では secure フラグを付けない", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await setActiveHouseholdCookie("h-new");

    expect(state.setCalls[0]?.options).toMatchObject({ secure: false });
  });
});
