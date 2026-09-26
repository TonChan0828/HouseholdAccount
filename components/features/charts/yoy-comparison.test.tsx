import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CategoryYoY } from "@/lib/yearly-analytics";

import { YoyComparison } from "./yoy-comparison";

const row = (over: Partial<CategoryYoY>): CategoryYoY => ({
  categoryId: "c",
  name: "食費",
  color: "#abc",
  amount: 0,
  prevAmount: 0,
  diff: 0,
  ratio: null,
  ...over,
});

describe("YoyComparison", () => {
  it("前年データが無ければプレースホルダを表示する", () => {
    render(
      <YoyComparison
        income={1000}
        expense={500}
        prevIncome={0}
        prevExpense={0}
        rows={[]}
        compareLabel="2025年 1月〜12月"
      />,
    );
    expect(screen.getByText("前年のデータがありません。")).toBeInTheDocument();
  });

  it("支出・収入の前年同期比と比較対象を表示する", () => {
    render(
      <YoyComparison
        income={330000}
        expense={120000}
        prevIncome={300000}
        prevExpense={100000}
        rows={[]}
        compareLabel="2025年 1月〜6月"
      />,
    );
    expect(screen.getByText(/2025年 1月〜6月/)).toBeInTheDocument();
    const expense = screen.getByTestId("yoy-total-expense");
    expect(within(expense).getByText("+¥20,000")).toBeInTheDocument();
    expect(within(expense).getByText("+20%")).toBeInTheDocument();
    const income = screen.getByTestId("yoy-total-income");
    expect(within(income).getByText("+¥30,000")).toBeInTheDocument();
    expect(within(income).getByText("+10%")).toBeInTheDocument();
  });

  it("カテゴリ別の増減を符号付きで並べ、前年0は「新規」と表示する", () => {
    render(
      <YoyComparison
        income={0}
        expense={90000}
        prevIncome={0}
        prevExpense={60000}
        rows={[
          row({ categoryId: "a", name: "娯楽", amount: 10000, prevAmount: 40000, diff: -30000, ratio: -0.75 }),
          row({ categoryId: "b", name: "旅行", amount: 50000, prevAmount: 0, diff: 50000, ratio: null }),
        ]}
        compareLabel="2025年"
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("娯楽")).toBeInTheDocument();
    expect(within(items[0]).getByText("-¥30,000")).toBeInTheDocument();
    expect(within(items[0]).getByText("-75%")).toBeInTheDocument();
    expect(within(items[1]).getByText("+¥50,000")).toBeInTheDocument();
    expect(within(items[1]).getByText("新規")).toBeInTheDocument();
  });
});
