import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CategoryMemberMatrix as Matrix } from "@/lib/category-matrix";

import { CategoryMemberMatrix } from "./category-member-matrix";

const members = [
  { userId: "user-1", displayName: "太郎" },
  { userId: "user-2", displayName: "花子" },
];

const emptySection = { rows: [], memberTotals: [0, 0], total: 0 };

const matrix: Matrix = {
  members,
  expense: {
    rows: [
      {
        categoryId: "cat-food",
        name: "食費",
        color: "#f97316",
        cells: [40000, 30000],
        total: 70000,
      },
      {
        categoryId: "cat-transport",
        name: "交通費",
        color: "#3b82f6",
        cells: [8000, 0],
        total: 8000,
      },
    ],
    memberTotals: [48000, 30000],
    total: 78000,
  },
  income: {
    rows: [
      {
        categoryId: "cat-salary",
        name: "給与",
        color: "#22c55e",
        cells: [320000, 0],
        total: 320000,
      },
    ],
    memberTotals: [320000, 0],
    total: 320000,
  },
};

describe("CategoryMemberMatrix", () => {
  it("見出しとセクション・カテゴリ行・整形金額を表示する", () => {
    render(<CategoryMemberMatrix matrix={matrix} />);

    expect(screen.getByText("メンバー別カテゴリ")).toBeInTheDocument();

    const expense = screen.getByTestId("matrix-expense");
    expect(within(expense).getByText("支出")).toBeInTheDocument();
    expect(within(expense).getByText("食費")).toBeInTheDocument();
    expect(within(expense).getByText("交通費")).toBeInTheDocument();
    expect(within(expense).getByText("¥40,000")).toBeInTheDocument();

    const income = screen.getByTestId("matrix-income");
    expect(within(income).getByText("収入")).toBeInTheDocument();
    expect(within(income).getByText("給与")).toBeInTheDocument();
  });

  it("列ヘッダはメンバー名と合計になる", () => {
    render(<CategoryMemberMatrix matrix={matrix} />);

    const expense = screen.getByTestId("matrix-expense");
    const headers = within(expense)
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    expect(headers).toEqual(["カテゴリ", "太郎", "花子", "合計"]);
  });

  it("合計行と合計列の値を表示する", () => {
    render(<CategoryMemberMatrix matrix={matrix} />);

    const expense = screen.getByTestId("matrix-expense");
    // 合計列（食費行）
    expect(within(expense).getByText("¥70,000")).toBeInTheDocument();
    // 合計行: メンバーごとの合計と総計
    expect(within(expense).getByText("¥48,000")).toBeInTheDocument();
    expect(within(expense).getByText("¥78,000")).toBeInTheDocument();
  });

  it("ゼロセルは - を表示する", () => {
    render(<CategoryMemberMatrix matrix={matrix} />);

    const expense = screen.getByTestId("matrix-expense");
    // 交通費 × 花子 のセル
    expect(within(expense).getAllByText("-").length).toBeGreaterThan(0);
    expect(within(expense).queryByText("¥0")).not.toBeInTheDocument();
  });

  it("行が無いセクションは描画しない", () => {
    render(
      <CategoryMemberMatrix matrix={{ ...matrix, income: emptySection }} />,
    );

    expect(screen.getByTestId("matrix-expense")).toBeInTheDocument();
    expect(screen.queryByTestId("matrix-income")).not.toBeInTheDocument();
  });

  it("両セクションとも空なら何も描画しない", () => {
    render(
      <CategoryMemberMatrix
        matrix={{ members, expense: emptySection, income: emptySection }}
      />,
    );

    expect(
      screen.queryByTestId("category-member-matrix"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("メンバー別カテゴリ")).not.toBeInTheDocument();
  });
});
