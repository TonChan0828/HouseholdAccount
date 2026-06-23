import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryCards } from "./summary-cards";

describe("SummaryCards", () => {
  it("収入・支出・収支差の金額を表示する", () => {
    render(<SummaryCards income={320000} expense={185400} />);

    expect(screen.getByText("¥320,000")).toBeInTheDocument();
    expect(screen.getByText("¥185,400")).toBeInTheDocument();
    // 収支差 = 320000 - 185400 = 134600
    expect(screen.getByText("¥134,600")).toBeInTheDocument();
  });

  it("収入・支出・収支のラベルを表示する", () => {
    render(<SummaryCards income={0} expense={0} />);

    expect(screen.getByText("収入")).toBeInTheDocument();
    expect(screen.getByText("支出")).toBeInTheDocument();
    expect(screen.getByText("収支")).toBeInTheDocument();
  });

  it("収支がマイナスのときはマイナス表記で表示する", () => {
    render(<SummaryCards income={1000} expense={3000} />);

    expect(screen.getByText("-¥2,000")).toBeInTheDocument();
  });

  it("前期の値が渡されたら前期比を表示する", () => {
    render(
      <SummaryCards
        income={320000}
        expense={185400}
        prevIncome={300000}
        prevExpense={200000}
      />,
    );

    expect(screen.getByText(/前期比 \+¥20,000/)).toBeInTheDocument();
    expect(screen.getByText(/前期比 -¥14,600/)).toBeInTheDocument();
  });

  it("前期の値が無いときは前期比を表示しない", () => {
    render(<SummaryCards income={100} expense={100} />);

    expect(screen.queryByText(/前期比/)).not.toBeInTheDocument();
  });

  it("消費バーは支出が収入に占める割合を表示する", () => {
    // 185400 / 320000 ≒ 0.579 → 58%
    render(<SummaryCards income={320000} expense={185400} />);

    expect(screen.getByText("支出は収入の58%")).toBeInTheDocument();
  });

  it("支出が収入を超過したときは超過額を表示する", () => {
    render(<SummaryCards income={1000} expense={3000} />);

    expect(screen.getByText(/支出が収入を超過/)).toBeInTheDocument();
    expect(screen.getByText(/\+¥2,000/)).toBeInTheDocument();
  });

  it("収入・支出がどちらも0のときは記録なしと表示する", () => {
    render(<SummaryCards income={0} expense={0} />);

    expect(screen.getByText("収入・支出の記録なし")).toBeInTheDocument();
  });

  it("消費バーにアクセシブルなラベルを付与する", () => {
    render(<SummaryCards income={320000} expense={185400} />);

    expect(
      screen.getByRole("img", { name: /支出は収入の/ }),
    ).toBeInTheDocument();
  });
});
