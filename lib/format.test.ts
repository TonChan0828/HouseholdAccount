import { describe, expect, it } from "vitest";

import { formatDayLabel, groupByDate, yen } from "./format";

describe("yen", () => {
  it("正の金額を ¥ 付き桁区切りで整形する", () => {
    expect(yen(1200)).toBe("¥1,200");
    expect(yen(0)).toBe("¥0");
  });

  it("負の金額はマイナスを ¥ の前に置く", () => {
    expect(yen(-134600)).toBe("-¥134,600");
  });
});

describe("formatDayLabel", () => {
  it("ISO 日付を「M月D日（曜）」に整形する", () => {
    expect(formatDayLabel("2026-06-10")).toBe("6月10日（水）");
    expect(formatDayLabel("2026-01-01")).toBe("1月1日（木）");
  });
});

describe("groupByDate", () => {
  it("date ごとに出現順を保ってグループ化する", () => {
    const rows = [
      { id: "a", date: "2026-06-10" },
      { id: "b", date: "2026-06-10" },
      { id: "c", date: "2026-06-08" },
    ];

    expect(groupByDate(rows)).toEqual([
      { date: "2026-06-10", items: [rows[0], rows[1]] },
      { date: "2026-06-08", items: [rows[2]] },
    ]);
  });

  it("空配列は空のまま返す", () => {
    expect(groupByDate([])).toEqual([]);
  });
});
