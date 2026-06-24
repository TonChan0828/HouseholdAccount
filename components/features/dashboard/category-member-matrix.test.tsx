import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("メンバー名は省略表示用の内側要素（truncate）で包む", () => {
    render(<CategoryMemberMatrix matrix={matrix} />);

    const expense = screen.getByTestId("matrix-expense");
    const nameEl = within(expense).getByText("太郎");
    // auto レイアウトでも省略が効くよう、th 直下ではなく block 要素で包む
    expect(nameEl.tagName).toBe("SPAN");
    expect(nameEl.className).toContain("truncate");
    expect(nameEl.className).toContain("block");
    expect(nameEl.parentElement?.tagName).toBe("TH");
  });

  it("表は横スクロール可能なコンテナに入っている", () => {
    const { container } = render(<CategoryMemberMatrix matrix={matrix} />);

    expect(container.querySelector(".overflow-x-auto")).not.toBeNull();
  });

  const mockScroll = (
    el: HTMLElement,
    dims: { scrollWidth: number; clientWidth: number; scrollLeft: number },
  ) => {
    for (const [k, value] of Object.entries(dims)) {
      Object.defineProperty(el, k, { value, configurable: true });
    }
    fireEvent.scroll(el);
  };

  it("右にスクロール余地があるときヒントを表示する", () => {
    const { container } = render(<CategoryMemberMatrix matrix={matrix} />);

    // 初期状態（jsdom はレイアウト計算しないため scrollWidth=0）では出さない
    expect(screen.queryByText(/横にスクロール/)).not.toBeInTheDocument();

    const scroller = container.querySelector(".overflow-x-auto") as HTMLElement;
    mockScroll(scroller, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 });

    expect(screen.getByText(/横にスクロール/)).toHaveClass("opacity-100");
  });

  it("末尾までスクロールしてもヒント行は残し、テキストだけ消す（表のガタつき防止）", () => {
    const { container } = render(<CategoryMemberMatrix matrix={matrix} />);
    const scroller = container.querySelector(".overflow-x-auto") as HTMLElement;

    // 右端まで到達（scrollLeft が余地と一致）
    mockScroll(scroller, {
      scrollWidth: 600,
      clientWidth: 300,
      scrollLeft: 300,
    });

    // 行は DOM に残る（高さを確保）が、テキストは不透明度0で見えない
    const hint = screen.getByText(/横にスクロール/);
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveClass("opacity-0");
  });

  it("スクロール不要（収まっている）のときはヒントもフェードも表示しない", () => {
    render(<CategoryMemberMatrix matrix={matrix} />);

    // scrollWidth=clientWidth=0 のまま → 余地なし
    expect(screen.queryByText(/横にスクロール/)).not.toBeInTheDocument();
  });
});
