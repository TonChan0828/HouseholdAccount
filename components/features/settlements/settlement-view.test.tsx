import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SettlementResult } from "@/lib/settlement";

import { SettlementView } from "./settlement-view";

const result: SettlementResult = {
  total: 4000,
  perMember: 2000,
  rows: [
    { userId: "u-1", displayName: "太郎", paid: 3000, balance: 1000 },
    { userId: "u-2", displayName: "花子", paid: 1000, balance: -1000 },
  ],
  transfers: [{ fromUserId: "u-2", toUserId: "u-1", amount: 1000 }],
};

describe("SettlementView", () => {
  it("合計・1人あたり負担額・メンバー別の立替と差額を表示する", () => {
    render(<SettlementView result={result} />);

    expect(screen.getByText("¥4,000")).toBeInTheDocument();
    expect(screen.getByText("¥2,000")).toBeInTheDocument();
    expect(screen.getByText("太郎")).toBeInTheDocument();
    expect(screen.getByText("¥1,000 受け取る")).toBeInTheDocument();
    expect(screen.getByText("¥1,000 支払う")).toBeInTheDocument();
  });

  it("送金案を「誰 → 誰」で表示する", () => {
    render(<SettlementView result={result} />);

    const transfer = screen.getByTestId("settlement-transfer");
    expect(transfer).toHaveTextContent("花子 → 太郎");
    expect(transfer).toHaveTextContent("¥1,000");
  });

  it("送金が不要なら「送金の必要はありません」を表示する", () => {
    render(
      <SettlementView
        result={{
          ...result,
          rows: result.rows.map((r) => ({ ...r, balance: 0 })),
          transfers: [],
        }}
      />,
    );

    expect(screen.getByText("送金の必要はありません。")).toBeInTheDocument();
    expect(screen.getAllByText("過不足なし")).toHaveLength(2);
  });
});
