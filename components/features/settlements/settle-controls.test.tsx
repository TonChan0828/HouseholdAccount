import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CancelSettlementButton, SettleButton } from "./settle-controls";

vi.mock("@/app/(dashboard)/settlements/actions", () => ({
  createSettlement: vi.fn(),
  deleteSettlement: vi.fn(),
}));

describe("SettleButton", () => {
  it("「精算済みにする」を押すと確認ダイアログが開く", async () => {
    const user = userEvent.setup();
    render(<SettleButton refParam="2026-07-01" />);

    await user.click(screen.getByRole("button", { name: "精算済みにする" }));

    expect(
      screen.getByRole("button", { name: "精算を確定する" }),
    ).toBeVisible();
    expect(
      screen.getByText("この期間を精算済みにしますか？"),
    ).toBeInTheDocument();
  });
});

describe("CancelSettlementButton", () => {
  it("取り消しは確認ステップを挟む", async () => {
    const user = userEvent.setup();
    render(<CancelSettlementButton settlementId="s-1" />);

    expect(
      screen.queryByRole("button", { name: "精算を取り消す" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取り消す" }));

    expect(
      screen.getByRole("button", { name: "精算を取り消す" }),
    ).toBeVisible();
  });

  it("キャンセルで確認ステップを閉じる", async () => {
    const user = userEvent.setup();
    render(<CancelSettlementButton settlementId="s-1" />);

    await user.click(screen.getByRole("button", { name: "取り消す" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(
      screen.queryByRole("button", { name: "精算を取り消す" }),
    ).not.toBeInTheDocument();
  });
});
