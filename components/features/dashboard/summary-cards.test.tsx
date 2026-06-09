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
});
