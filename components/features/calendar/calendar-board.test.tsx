import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransactionDialogProvider } from "@/components/features/transactions/transaction-dialog";
import type { CalendarDay } from "@/lib/calendar";
import { CalendarBoard, type CalendarTx } from "./calendar-board";

const day = (date: string, over: Partial<CalendarDay> = {}): CalendarDay => ({
  date,
  inMonth: true,
  income: 0,
  expense: 0,
  ...over,
});

const week: CalendarDay[] = [
  day("2026-05-31", { inMonth: false }),
  day("2026-06-01", { income: 1000 }),
  day("2026-06-02", { expense: 500 }),
  day("2026-06-03"),
  day("2026-06-04"),
  day("2026-06-05"),
  day("2026-06-06"),
];

const txByDate: Record<string, CalendarTx[]> = {
  "2026-06-02": [
    {
      id: "t1",
      amount: 500,
      type: "expense",
      date: "2026-06-02",
      memo: "ランチ",
      category: { name: "食費", color: "#ef4444" },
      category_id: "c-1",
      created_by: "u-1",
      is_shared: false,
    },
    {
      id: "t2",
      amount: 300,
      type: "expense",
      date: "2026-06-02",
      memo: "他人のおやつ",
      category: { name: "食費", color: "#ef4444" },
      category_id: "c-1",
      created_by: "u-2",
      is_shared: false,
    },
  ],
};

function renderBoard() {
  return render(
    <CalendarBoard
      weeks={[week]}
      transactionsByDate={txByDate}
      initialSelected="2026-06-01"
    />,
  );
}

describe("CalendarBoard", () => {
  it("曜日ヘッダー（日〜土）を表示する", () => {
    renderBoard();
    for (const w of ["日", "月", "火", "水", "木", "金", "土"]) {
      expect(screen.getByText(w, { selector: "span,div,th" })).toBeInTheDocument();
    }
  });

  it("各日セルを7個描画し、収入合計を表示する", () => {
    renderBoard();
    expect(screen.getAllByTestId("calendar-day")).toHaveLength(7);
    expect(screen.getByText("+1,000")).toBeInTheDocument();
  });

  it("当月外のセルは data-in-month=false を持つ", () => {
    const { container } = renderBoard();
    const cell = container.querySelector('[data-date="2026-05-31"]');
    expect(cell).toHaveAttribute("data-in-month", "false");
  });

  it("初期選択日に明細がなければ空状態を表示する", () => {
    renderBoard();
    expect(screen.getByText("この日の収支はありません。")).toBeInTheDocument();
  });

  it("日をクリックするとその日の明細を表示する", () => {
    const { container } = renderBoard();
    const cell = container.querySelector('[data-date="2026-06-02"]');
    fireEvent.click(cell as Element);
    expect(screen.getByText("ランチ")).toBeInTheDocument();
    expect(screen.getAllByText("食費")).not.toHaveLength(0);
  });
});

describe("CalendarBoard: 明細からの編集（spec 40）", () => {
  const renderWithUser = () =>
    render(
      <TransactionDialogProvider categories={[]} otherHouseholds={[]}>
        <CalendarBoard
          weeks={[week]}
          transactionsByDate={txByDate}
          initialSelected="2026-06-01"
          currentUserId="u-1"
        />
      </TransactionDialogProvider>,
    );

  it("自分が登録した明細だけを編集トリガーにする", () => {
    const { container } = renderWithUser();
    fireEvent.click(container.querySelector('[data-date="2026-06-02"]')!);

    const triggers = screen.getAllByRole("button", { name: "編集" });
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toHaveTextContent("ランチ");
  });

  it("明細をタップすると編集ダイアログが開く", () => {
    const { container } = renderWithUser();
    fireEvent.click(container.querySelector('[data-date="2026-06-02"]')!);
    fireEvent.click(screen.getByRole("button", { name: "編集" }));

    expect(screen.getByTestId("transaction-dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("金額")).toHaveValue("500");
  });

  it("編集ページへのリンクは張らない（ダイアログで完結する）", () => {
    const { container } = renderWithUser();
    fireEvent.click(container.querySelector('[data-date="2026-06-02"]')!);

    expect(
      container.querySelector('a[href^="/transactions/"]'),
    ).toBeNull();
  });

  it("currentUserId 未指定なら編集トリガーを出さない", () => {
    const { container } = renderBoard();
    fireEvent.click(container.querySelector('[data-date="2026-06-02"]')!);

    expect(
      screen.queryByRole("button", { name: "編集" }),
    ).not.toBeInTheDocument();
  });
});

describe("CalendarBoard: デスクトップ2カラム構成", () => {
  it("side スロットの内容（サマリー等）を表示する", () => {
    render(
      <CalendarBoard
        weeks={[week]}
        transactionsByDate={txByDate}
        initialSelected="2026-06-01"
        side={<p>サマリーカード</p>}
      />,
    );
    expect(screen.getByText("サマリーカード")).toBeInTheDocument();
  });

  it("メイン=グリッド / サイド=サマリー+明細 の2カラムを MainSideGrid で構成する", () => {
    const { container } = render(
      <CalendarBoard
        weeks={[week]}
        transactionsByDate={txByDate}
        initialSelected="2026-06-01"
        side={<p>サマリーカード</p>}
      />,
    );
    const grid = container.querySelector('[data-testid="main-side-grid"]');
    expect(grid).not.toBeNull();
    // モバイルの縦積み順: サマリー(1) → カレンダーグリッド(2) → 明細(3)
    expect(container.querySelector(".max-lg\\:order-1")).toHaveTextContent(
      "サマリーカード",
    );
    const gridWrapper = container.querySelector(".max-lg\\:order-2");
    expect(
      gridWrapper?.querySelector('[data-testid="calendar-day"]'),
    ).not.toBeNull();
    expect(container.querySelector(".max-lg\\:order-3")).toHaveTextContent(
      "この日の収支はありません。",
    );
  });

  it("side 未指定でもグリッドと明細を表示する", () => {
    renderBoard();
    expect(screen.getAllByTestId("calendar-day")).toHaveLength(7);
    expect(screen.getByText("この日の収支はありません。")).toBeInTheDocument();
  });
});

describe("CalendarBoard: ローカルの今日への補正", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // システム時刻はローカルコンストラクタで組み立てるため TZ に依らず決定的。
  const setLocalNow = (y: number, m1: number, d: number) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(y, m1 - 1, d, 1, 30));
  };

  it("ローカルの今日が当月内なら、初期選択を今日へ補正しハイライトする", () => {
    // サーバは UTC 基準で 6/1 を初期選択にしたが、ユーザーのローカルは 6/3。
    setLocalNow(2026, 6, 3);
    const { container } = renderBoard();

    const todayCell = container.querySelector('[data-date="2026-06-03"]');
    expect(todayCell).toHaveAttribute("aria-pressed", "true");
    expect(
      container.querySelector('[data-date="2026-06-01"]'),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("ローカルの今日が表示月に無ければ初期選択のまま", () => {
    setLocalNow(2026, 7, 15);
    const { container } = renderBoard();

    expect(
      container.querySelector('[data-date="2026-06-01"]'),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("ローカルの今日が当月外セル（前月の埋め日）でも補正しない", () => {
    // 5/31 はグリッドに存在するが inMonth=false のため補正対象にしない。
    setLocalNow(2026, 5, 31);
    const { container } = renderBoard();

    expect(
      container.querySelector('[data-date="2026-06-01"]'),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
