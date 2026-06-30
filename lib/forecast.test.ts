import { describe, expect, it } from "vitest";

import {
  buildForecast,
  buildForecastBudget,
  type ForecastTx,
} from "@/lib/forecast";
import type { PeriodRange } from "@/lib/period";

/** UTC 真夜中の Date。 */
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** 暦月 6 月（startDay=1）の期間 [2026-06-01, 2026-07-01) = 30 日。 */
const june: PeriodRange = { start: utc("2026-06-01"), end: utc("2026-07-01") };

const tx = (
  type: "income" | "expense",
  amount: number,
  recurring_id: string | null = null,
  category_id: string | null = null,
): ForecastTx & { category_id: string | null } => ({
  type,
  amount,
  recurring_id,
  category_id,
});

describe("buildForecast", () => {
  it("期中ハイブリッド: 固定は満額・変動だけ日割り外挿する", () => {
    // 6/10 時点 = 経過10日/30日 → factor 3。
    const r = buildForecast(
      [tx("expense", 80_000, "r1"), tx("expense", 20_000, null)],
      june,
      utc("2026-06-10"),
    );
    expect(r.totalDays).toBe(30);
    expect(r.daysElapsed).toBe(10);
    expect(r.daysRemaining).toBe(20);
    expect(r.factor).toBeCloseTo(3, 10);
    expect(r.actualExpense).toBe(100_000);
    // 80000(固定) + 20000*3(変動) = 140000
    expect(r.projectedExpense).toBe(140_000);
    expect(r.projectedIncome).toBe(0);
    expect(r.projectedBalance).toBe(-140_000);
  });

  it("期首(経過1日): 変動は最大外挿・固定は不変", () => {
    const r = buildForecast(
      [tx("expense", 80_000, "r1"), tx("expense", 1_000, null)],
      june,
      utc("2026-06-01"),
    );
    expect(r.daysElapsed).toBe(1);
    expect(r.factor).toBeCloseTo(30, 10);
    // 80000 + 1000*30 = 110000
    expect(r.projectedExpense).toBe(110_000);
  });

  it("固定のみは外挿されず予測＝実績", () => {
    const r = buildForecast(
      [tx("expense", 50_000, "r1"), tx("income", 200_000, "r2")],
      june,
      utc("2026-06-10"),
    );
    expect(r.projectedExpense).toBe(50_000);
    expect(r.projectedIncome).toBe(200_000);
  });

  it("期末以降は daysElapsed が totalDays にクランプされ予測＝実績", () => {
    const r = buildForecast(
      [tx("expense", 30_000, null)],
      june,
      utc("2026-07-05"),
    );
    expect(r.daysElapsed).toBe(30);
    expect(r.daysRemaining).toBe(0);
    expect(r.factor).toBeCloseTo(1, 10);
    expect(r.projectedExpense).toBe(30_000);
  });

  it("期間開始前は daysElapsed=1 にクランプ", () => {
    const r = buildForecast(
      [tx("expense", 1_000, null)],
      june,
      utc("2026-05-20"),
    );
    expect(r.daysElapsed).toBe(1);
    expect(r.factor).toBeCloseTo(30, 10);
  });

  it("空配列はすべて 0", () => {
    const r = buildForecast([], june, utc("2026-06-10"));
    expect(r.actualExpense).toBe(0);
    expect(r.actualIncome).toBe(0);
    expect(r.projectedExpense).toBe(0);
    expect(r.projectedBalance).toBe(0);
  });

  it("変動外挿は四捨五入する", () => {
    // 6/7 = 経過7日/30日。10000*30/7 = 42857.14… → 42857
    const r = buildForecast(
      [tx("expense", 10_000, null)],
      june,
      utc("2026-06-07"),
    );
    expect(r.daysElapsed).toBe(7);
    expect(r.projectedExpense).toBe(42_857);
  });
});

describe("buildForecastBudget", () => {
  const fc = (today: string) =>
    buildForecast([], june, utc(today)); // factor だけ使うので txs は空でよい

  it("予算未設定（amount>0 が無い）なら null", () => {
    const r = buildForecastBudget([{ category_id: "c1", amount: 0 }], [], fc("2026-06-10"));
    expect(r).toBeNull();
  });

  it("予算対象カテゴリの変動だけ外挿して着地支出を出す", () => {
    const forecast = fc("2026-06-10"); // factor 3
    const r = buildForecastBudget(
      [{ category_id: "food", amount: 100_000 }],
      [tx("expense", 20_000, null, "food")],
      forecast,
    );
    expect(r).not.toBeNull();
    expect(r?.totalBudget).toBe(100_000);
    expect(r?.projectedSpent).toBe(60_000); // 20000*3
    expect(r?.willOverrun).toBe(false);
    expect(r?.overBy).toBe(0);
  });

  it("着地が予算を超えると willOverrun=true・overBy を出す", () => {
    const forecast = fc("2026-06-10"); // factor 3
    const r = buildForecastBudget(
      [{ category_id: "food", amount: 100_000 }],
      [tx("expense", 40_000, null, "food")],
      forecast,
    );
    expect(r?.projectedSpent).toBe(120_000); // 40000*3
    expect(r?.willOverrun).toBe(true);
    expect(r?.overBy).toBe(20_000);
  });

  it("予算対象カテゴリの固定費は外挿しない／対象外カテゴリは集計しない", () => {
    const forecast = fc("2026-06-10"); // factor 3
    const r = buildForecastBudget(
      [{ category_id: "food", amount: 100_000 }],
      [
        tx("expense", 50_000, "r1", "food"), // 固定 → 満額
        tx("expense", 10_000, null, "food"), // 変動 → ×3
        tx("expense", 99_000, null, "fun"), // 予算対象外 → 無視
        tx("income", 30_000, null, "food"), // 収入 → 無視
      ],
      forecast,
    );
    // 50000 + 10000*3 = 80000
    expect(r?.projectedSpent).toBe(80_000);
  });
});
