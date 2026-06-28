import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
      memo: "ランチ",
      category: { name: "食費", color: "#ef4444" },
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
    expect(screen.getByText("+¥1,000")).toBeInTheDocument();
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
    expect(screen.getByText("食費")).toBeInTheDocument();
  });
});
