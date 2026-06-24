import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { MemberSummary } from "@/lib/members";

import { MemberActivity, type MemberTxRow } from "./member-activity";

const summaries: MemberSummary[] = [
  {
    userId: "user-1",
    displayName: "太郎",
    income: 320000,
    expense: 4700,
    count: 3,
  },
  { userId: "user-2", displayName: "花子", income: 0, expense: 0, count: 0 },
];

const txs: MemberTxRow[] = [
  {
    id: "tx-1",
    amount: 320000,
    type: "income",
    date: "2026-06-08",
    memo: "6月給与",
    created_by: "user-1",
    category: { name: "給与", color: "#10b981" },
  },
  {
    id: "tx-2",
    amount: 3200,
    type: "expense",
    date: "2026-06-09",
    memo: null,
    created_by: "user-1",
    category: { name: "食費", color: "#ef4444" },
  },
];

describe("MemberActivity", () => {
  it("全メンバーのサマリーカードを表示する", () => {
    render(<MemberActivity summaries={summaries} txs={txs} />);

    expect(screen.getByRole("button", { name: /太郎/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /花子/ })).toBeInTheDocument();
    expect(screen.getByText("¥320,000")).toBeInTheDocument();
    expect(screen.getByText("¥4,700")).toBeInTheDocument();
    expect(screen.getByText("3件")).toBeInTheDocument();
  });

  it("初期状態では取引一覧を表示しない", () => {
    render(<MemberActivity summaries={summaries} txs={txs} />);

    expect(screen.queryByText("6月給与")).not.toBeInTheDocument();
  });

  it("カードをクリックするとそのメンバーの取引一覧を展開する", async () => {
    const user = userEvent.setup();
    render(<MemberActivity summaries={summaries} txs={txs} />);

    await user.click(screen.getByRole("button", { name: /太郎/ }));

    expect(screen.getByText("6月給与")).toBeInTheDocument();
    expect(screen.getByText("食費")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /太郎/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("選択中のカードを再クリックすると閉じる", async () => {
    const user = userEvent.setup();
    render(<MemberActivity summaries={summaries} txs={txs} />);

    await user.click(screen.getByRole("button", { name: /太郎/ }));
    await user.click(screen.getByRole("button", { name: /太郎/ }));

    expect(screen.queryByText("6月給与")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /太郎/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("別のカードをクリックすると表示対象が切り替わる", async () => {
    const user = userEvent.setup();
    render(<MemberActivity summaries={summaries} txs={txs} />);

    await user.click(screen.getByRole("button", { name: /太郎/ }));
    await user.click(screen.getByRole("button", { name: /花子/ }));

    expect(screen.queryByText("6月給与")).not.toBeInTheDocument();
    expect(
      screen.getByText("この期間の取引はありません。"),
    ).toBeInTheDocument();
  });

  it("6人いてもアバター色が全員異なる（色の使い回しをしない）", () => {
    const many: MemberSummary[] = Array.from({ length: 6 }, (_, i) => ({
      userId: `user-${i}`,
      displayName: `メンバー${i}`,
      income: 0,
      expense: 0,
      count: 0,
    }));

    const { container } = render(<MemberActivity summaries={many} txs={[]} />);

    const cards = screen.getAllByTestId("member-card");
    expect(cards).toHaveLength(6);

    const avatars = container.querySelectorAll<HTMLElement>(
      "[style*='background-color']",
    );
    const colors = [...avatars].map((el) => el.style.backgroundColor);
    expect(colors).toHaveLength(6);
    expect(new Set(colors).size).toBe(6);
  });
});
