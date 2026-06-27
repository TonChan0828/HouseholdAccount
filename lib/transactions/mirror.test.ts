import { describe, expect, it } from "vitest";

import { buildMirrorRows, type MirrorSource, type MirrorTarget } from "./mirror";

const USER = "user-1";

const baseSource: MirrorSource = {
  type: "expense",
  amount: 1200,
  date: "2026-06-27",
  categoryName: "食費",
  memo: "ランチ",
};

describe("buildMirrorRows", () => {
  it("名前+type が一致するカテゴリに紐付ける", () => {
    const targets: MirrorTarget[] = [
      {
        householdId: "hh-a",
        categories: [
          { id: "cat-a-food", name: "食費", type: "expense" },
          { id: "cat-a-pay", name: "給与", type: "income" },
        ],
      },
    ];

    const rows = buildMirrorRows(baseSource, USER, targets);

    expect(rows).toEqual([
      {
        household_id: "hh-a",
        created_by: USER,
        type: "expense",
        amount: 1200,
        date: "2026-06-27",
        category_id: "cat-a-food",
        memo: "ランチ",
      },
    ]);
  });

  it("一致するカテゴリが無ければ category_id は null（未分類）", () => {
    const targets: MirrorTarget[] = [
      {
        householdId: "hh-b",
        categories: [{ id: "cat-b-pay", name: "給与", type: "income" }],
      },
    ];

    const rows = buildMirrorRows(baseSource, USER, targets);

    expect(rows[0].category_id).toBeNull();
    expect(rows[0].household_id).toBe("hh-b");
  });

  it("反映元にカテゴリが無ければ category_id は null", () => {
    const source: MirrorSource = { ...baseSource, categoryName: null };
    const targets: MirrorTarget[] = [
      {
        householdId: "hh-a",
        categories: [{ id: "cat-a-food", name: "食費", type: "expense" }],
      },
    ];

    const rows = buildMirrorRows(source, USER, targets);

    expect(rows[0].category_id).toBeNull();
  });

  it("type が both のカテゴリにもマッチする", () => {
    const targets: MirrorTarget[] = [
      {
        householdId: "hh-c",
        categories: [{ id: "cat-c-food", name: "食費", type: "both" }],
      },
    ];

    const rows = buildMirrorRows(baseSource, USER, targets);

    expect(rows[0].category_id).toBe("cat-c-food");
  });

  it("名前の大文字小文字・前後空白を無視してマッチする", () => {
    const source: MirrorSource = { ...baseSource, categoryName: "Food" };
    const targets: MirrorTarget[] = [
      {
        householdId: "hh-d",
        categories: [{ id: "cat-d", name: " food ", type: "expense" }],
      },
    ];

    const rows = buildMirrorRows(source, USER, targets);

    expect(rows[0].category_id).toBe("cat-d");
  });

  it("複数ターゲットそれぞれで独立に解決する", () => {
    const targets: MirrorTarget[] = [
      {
        householdId: "hh-a",
        categories: [{ id: "cat-a-food", name: "食費", type: "expense" }],
      },
      {
        householdId: "hh-b",
        categories: [{ id: "cat-b-pay", name: "給与", type: "income" }],
      },
    ];

    const rows = buildMirrorRows(baseSource, USER, targets);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ household_id: "hh-a", category_id: "cat-a-food" });
    expect(rows[1]).toMatchObject({ household_id: "hh-b", category_id: null });
  });

  it("ターゲットが空なら空配列を返す", () => {
    expect(buildMirrorRows(baseSource, USER, [])).toEqual([]);
  });
});
