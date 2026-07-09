import { describe, expect, it } from "vitest";

import { getUnrecordedReminderCategories } from "@/lib/reminder";

const food = { id: "cat-food", name: "食費" };
const rent = { id: "cat-rent", name: "家賃" };

const base = {
  viewingCurrent: true,
  daysRemaining: 3,
  targets: [food, rent],
  countByCategoryId: {},
};

describe("getUnrecordedReminderCategories", () => {
  it("残り3日以内・対象カテゴリが0件なら未登録カテゴリを返す", () => {
    expect(getUnrecordedReminderCategories(base)).toEqual([food, rent]);
  });

  it("件数が1件以上あるカテゴリは除外する", () => {
    expect(
      getUnrecordedReminderCategories({
        ...base,
        countByCategoryId: { "cat-food": 1 },
      }),
    ).toEqual([rent]);
  });

  it("全カテゴリに登録があれば空配列", () => {
    expect(
      getUnrecordedReminderCategories({
        ...base,
        countByCategoryId: { "cat-food": 2, "cat-rent": 1 },
      }),
    ).toEqual([]);
  });

  it("残り4日（閾値超過）なら空配列", () => {
    expect(
      getUnrecordedReminderCategories({ ...base, daysRemaining: 4 }),
    ).toEqual([]);
  });

  it("当期を表示していなければ空配列", () => {
    expect(
      getUnrecordedReminderCategories({ ...base, viewingCurrent: false }),
    ).toEqual([]);
  });

  it("対象カテゴリが無ければ空配列", () => {
    expect(
      getUnrecordedReminderCategories({ ...base, targets: [] }),
    ).toEqual([]);
  });
});
