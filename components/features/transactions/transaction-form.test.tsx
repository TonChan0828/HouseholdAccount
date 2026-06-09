import { render, screen } from "@testing-library/react";
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

describe("TransactionForm", () => {
  it("金額・日付・カテゴリ・メモの入力欄と送信ボタンを表示する", () => {
    render(
      <TransactionForm
        action={noop}
        categories={categories}
        submitLabel="登録する"
      />,
    );
    expect(screen.getByLabelText("金額")).toBeInTheDocument();
    expect(screen.getByLabelText("日付")).toBeInTheDocument();
    expect(screen.getByLabelText("カテゴリ")).toBeInTheDocument();
    expect(screen.getByLabelText("メモ")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登録する" }),
    ).toBeInTheDocument();
  });

  it("支出/収入のトグルを表示する", () => {
    render(
      <TransactionForm
        action={noop}
        categories={categories}
        submitLabel="登録する"
      />,
    );
    expect(screen.getByRole("radio", { name: "支出" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "収入" })).toBeInTheDocument();
  });

  it("デフォルト（支出）では支出カテゴリを選択肢に出す", () => {
    render(
      <TransactionForm
        action={noop}
        categories={categories}
        submitLabel="登録する"
      />,
    );
    expect(
      screen.getByRole("option", { name: "食費" }),
    ).toBeInTheDocument();
  });
});
