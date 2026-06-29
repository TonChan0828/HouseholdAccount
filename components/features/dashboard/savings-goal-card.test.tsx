import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { upsertSavingsGoal } from "@/app/(dashboard)/dashboard/savings-goal-actions";

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

  it("保存に失敗してもモーダルの入力値が保持される", async () => {
    const user = userEvent.setup();
    vi.mocked(upsertSavingsGoal).mockResolvedValue({
      error: "保存に失敗しました",
    });

    render(<SavingsGoalCard progress={null} goal={null} />);
    await user.click(screen.getByRole("button", { name: "目標を設定" }));

    await user.type(await screen.findByLabelText("目標名"), "旅行資金");
    await user.type(screen.getByLabelText("目標額"), "300000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    // エラー表示後も入力値が消えないこと（非制御だと defaultValue にリセットされる）。
    expect(await screen.findByText("保存に失敗しました")).toBeInTheDocument();
    expect(screen.getByLabelText("目標名")).toHaveValue("旅行資金");
    expect(screen.getByLabelText("目標額")).toHaveValue("300000");
  });
});
