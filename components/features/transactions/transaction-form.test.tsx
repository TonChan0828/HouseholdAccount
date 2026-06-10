import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Category } from "@/types";

import { TransactionForm } from "./transaction-form";

const noop = async () => undefined;

const categories: Category[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    household_id: "h1",
    name: "食費",
    color: "#ef4444",
    icon: null,
    type: "expense",
    is_default: true,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    household_id: "h1",
    name: "給与",
    color: "#10b981",
    icon: null,
    type: "income",
    is_default: true,
  },
];

function renderForm() {
  return render(
    <TransactionForm
      action={noop}
      categories={categories}
      submitLabel="登録する"
    />,
  );
}

describe("TransactionForm", () => {
  it("金額・日付・カテゴリ・メモの入力欄と送信ボタンを表示する", () => {
    renderForm();

    expect(screen.getByLabelText("金額")).toBeInTheDocument();
    expect(screen.getByLabelText("日付")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "カテゴリ" })).toBeInTheDocument();
    expect(screen.getByLabelText("メモ")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登録する" }),
    ).toBeInTheDocument();
  });

  it("支出/収入のトグルを表示する", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "支出" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "収入" })).toBeInTheDocument();
  });

  it("デフォルト（支出）では支出カテゴリのチップを出す", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "食費" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "給与" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "未選択" })).toBeInTheDocument();
  });

  it("収入に切り替えると収入カテゴリのチップに入れ替わる", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "収入" }));

    expect(screen.getByRole("radio", { name: "給与" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "食費" })).not.toBeInTheDocument();
  });
});
