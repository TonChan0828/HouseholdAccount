import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteTransactionButton } from "./delete-transaction-button";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), rethrow: vi.fn() }));
vi.mock("@/app/(dashboard)/transactions/actions", () => ({
  deleteTransaction: mocks.remove,
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: mocks.rethrow }));

const transaction = {
  id: "t-1",
  date: "2026-10-05",
  amount: 1200,
  type: "expense" as const,
  memo: "ランチ",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.remove.mockResolvedValue(undefined);
});

async function openDialog() {
  const user = userEvent.setup();
  render(<DeleteTransactionButton transaction={transaction} />);
  await user.click(screen.getByRole("button", { name: "削除" }));
  return user;
}

describe("DeleteTransactionButton", () => {
  it("対象を確認するまで削除せず、キャンセルできる", async () => {
    const user = await openDialog();
    expect(screen.getByRole("dialog", { name: "収支を削除しますか？" })).toBeInTheDocument();
    expect(screen.getByText(transaction.date)).toBeInTheDocument();
    expect(screen.getByText("¥1,200")).toBeInTheDocument();
    expect(screen.getByText("支出")).toBeInTheDocument();
    expect(screen.getByText("ランチ")).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("確認後に対象IDを送信し、通常完了したら閉じる", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
    expect(mocks.remove.mock.calls[0][0].get("id")).toBe("t-1");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("送信中は再送信とキャンセル・Escapeでの終了を防ぐ", async () => {
    let resolve!: () => void;
    mocks.remove.mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const user = await openDialog();
    const confirm = screen.getByRole("button", { name: "削除する" });
    await user.click(confirm);
    expect(screen.getByRole("button", { name: "削除中…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    fireEvent.submit(confirm.closest("form")!);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });

  it("削除に失敗したら確認画面にエラーを表示し、再試行できる", async () => {
    const failure = new Error("database unavailable");
    mocks.remove.mockRejectedValueOnce(failure);
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "削除する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("収支の削除に失敗しました");
    expect(mocks.rethrow).toHaveBeenCalledWith(failure);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
