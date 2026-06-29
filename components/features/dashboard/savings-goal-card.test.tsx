import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SavingsGoalCard } from "./savings-goal-card";

// Server Action はクライアントから import されるためモックする。
vi.mock("@/app/(dashboard)/dashboard/savings-goal-actions", () => ({
  upsertSavingsGoal: vi.fn(),
  deleteSavingsGoal: vi.fn(),
}));

describe("SavingsGoalCard", () => {
  it("目標未設定なら空状態と設定ボタンを出す", () => {
    render(<SavingsGoalCard progress={null} goal={null} />);
    expect(screen.getByText("目標を設定")).toBeInTheDocument();
  });

  it("目標ありなら名前・進捗率・残額を出す", () => {
    render(
      <SavingsGoalCard
        progress={{
          name: "旅行資金",
          targetAmount: 300_000,
          saved: 80_000,
          pct: 27,
          remaining: 220_000,
          reached: false,
          pace: null,
        }}
        goal={{ start_date: "2026-04-01", target_date: null }}
      />,
    );
    expect(screen.getByText("旅行資金")).toBeInTheDocument();
    expect(screen.getByText("27%")).toBeInTheDocument();
    expect(screen.getByText(/残り/)).toBeInTheDocument();
  });

  it("期日ありはペース（あとMヶ月・月◯円）を出す", () => {
    render(
      <SavingsGoalCard
        progress={{
          name: "旅行資金",
          targetAmount: 300_000,
          saved: 80_000,
          pct: 27,
          remaining: 220_000,
          reached: false,
          pace: { monthsLeft: 7, requiredPerMonth: 31_429, overdue: false },
        }}
        goal={{ start_date: "2026-04-01", target_date: "2026-12-31" }}
      />,
    );
    expect(screen.getByText(/あと7ヶ月/)).toBeInTheDocument();
  });

  it("達成済みは達成表示を出す", () => {
    render(
      <SavingsGoalCard
        progress={{
          name: "旅行資金",
          targetAmount: 300_000,
          saved: 300_000,
          pct: 100,
          remaining: 0,
          reached: true,
          pace: null,
        }}
        goal={{ start_date: "2026-04-01", target_date: null }}
      />,
    );
    expect(screen.getByText(/達成/)).toBeInTheDocument();
  });
});
