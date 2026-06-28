import { describe, expect, it } from "vitest";

import { compactAmount, formatDayLabel, groupByDate, yen } from "./format";

describe("yen", () => {
  it("正の金額を ¥ 付き桁区切りで整形する", () => {
    expect(yen(1200)).toBe("¥1,200");
    expect(yen(0)).toBe("¥0");
  });

  it("負の金額はマイナスを ¥ の前に置く", () => {
    expect(yen(-134600)).toBe("-¥134,600");
  });
});

describe("compactAmount", () => {
  it("1万未満は桁区切りでそのまま表示する", () => {
    expect(compactAmount(1200)).toBe("1,200");
    expect(compactAmount(0)).toBe("0");
  });

  it("1万以上は「万」単位に丸める", () => {
    expect(compactAmount(10000)).toBe("1万");
    expect(compactAmount(12000)).toBe("1.2万");
    expect(compactAmount(1234567)).toBe("123.5万");
  });

  it("符号は無視して絶対値で整形する", () => {
    expect(compactAmount(-12000)).toBe("1.2万");
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
