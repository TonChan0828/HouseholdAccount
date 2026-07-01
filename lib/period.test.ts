import { describe, expect, it } from "vitest";

import {
  formatPeriodLabel,
  getPeriodRange,
  localToday,
  shiftPeriod,
  toISODate,
} from "./period";

// UTC で日付を組み立てるヘルパー（TZ 揺れを避ける）
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("getPeriodRange", () => {
  it("開始日1（暦月）: 月内の日付はその月の1日〜翌月1日(排他)", () => {
    const { start, end } = getPeriodRange(utc(2026, 6, 15), 1);
    expect(toISODate(start)).toBe("2026-06-01");
    expect(toISODate(end)).toBe("2026-07-01");
  });

  it("開始日25: 開始日より前の日付は前月25日始まり", () => {
    const { start, end } = getPeriodRange(utc(2026, 6, 10), 25);
    expect(toISODate(start)).toBe("2026-05-25");
    expect(toISODate(end)).toBe("2026-06-25");
  });

  it("開始日25: 開始日当日はその月25日始まり", () => {
    const { start, end } = getPeriodRange(utc(2026, 6, 25), 25);
    expect(toISODate(start)).toBe("2026-06-25");
    expect(toISODate(end)).toBe("2026-07-25");
  });

  it("年跨ぎ: 12月は翌年1月1日が排他境界", () => {
    const { start, end } = getPeriodRange(utc(2026, 12, 20), 1);
    expect(toISODate(start)).toBe("2026-12-01");
    expect(toISODate(end)).toBe("2027-01-01");
  });

  it("うるう年2月: 排他境界は3月1日（最終日は2/29）", () => {
    const { start, end } = getPeriodRange(utc(2024, 2, 10), 1);
    expect(toISODate(start)).toBe("2024-02-01");
    expect(toISODate(end)).toBe("2024-03-01");
  });
});

describe("shiftPeriod", () => {
  it("+1 で次の期間へ", () => {
    const range = getPeriodRange(utc(2026, 6, 15), 1);
    const next = shiftPeriod(range, 1, 1);
    expect(toISODate(next.start)).toBe("2026-07-01");
    expect(toISODate(next.end)).toBe("2026-08-01");
  });

  it("-1 で前の期間へ（年跨ぎ）", () => {
    const range = getPeriodRange(utc(2026, 1, 10), 1);
    const prev = shiftPeriod(range, -1, 1);
    expect(toISODate(prev.start)).toBe("2025-12-01");
    expect(toISODate(prev.end)).toBe("2026-01-01");
  });

  it("開始日25 でも前後移動が成立する", () => {
    const range = getPeriodRange(utc(2026, 6, 25), 25);
    const next = shiftPeriod(range, 1, 25);
    expect(toISODate(next.start)).toBe("2026-07-25");
    expect(toISODate(next.end)).toBe("2026-08-25");
  });
});

describe("formatPeriodLabel", () => {
  it("開始日〜最終日（排他境界の前日）を表示する", () => {
    const range = getPeriodRange(utc(2026, 6, 15), 1);
    expect(formatPeriodLabel(range)).toBe("2026/06/01 〜 2026/06/30");
  });

  it("非うるう年の2月は2/28まで", () => {
    const range = getPeriodRange(utc(2026, 2, 10), 1);
    expect(formatPeriodLabel(range)).toBe("2026/02/01 〜 2026/02/28");
  });
});

describe("localToday", () => {
  // ローカルコンストラクタで組み立てるため、実行環境の TZ に依らず決定的。
  it("ローカル日付を YYYY-MM-DD にする", () => {
    expect(localToday(new Date(2026, 6, 2, 0, 30))).toBe("2026-07-02");
  });

  it("月・日を0埋めする", () => {
    expect(localToday(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });

  it("ローカルの日境界（深夜）でも日付が繰り上がらない・繰り下がらない", () => {
    expect(localToday(new Date(2026, 11, 31, 23, 59, 59))).toBe("2026-12-31");
    expect(localToday(new Date(2027, 0, 1, 0, 0, 0))).toBe("2027-01-01");
  });
});
