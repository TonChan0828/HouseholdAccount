import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { TransactionActionState } from "@/app/(dashboard)/transactions/actions";
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

function renderForm(props?: {
  action?: (
    state: TransactionActionState,
    formData: FormData,
  ) => Promise<TransactionActionState>;
  enableContinue?: boolean;
}) {
  return render(
    <TransactionForm
      action={props?.action ?? noop}
      categories={categories}
      submitLabel="登録する"
      enableContinue={props?.enableContinue}
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

  it("enableContinue 未指定では「登録して続ける」ボタンを出さない", () => {
    renderForm();

    expect(
      screen.queryByRole("button", { name: "登録して続ける" }),
    ).not.toBeInTheDocument();
  });

  it("enableContinue 指定時は「登録して続ける」ボタンを出す", () => {
    renderForm({ enableContinue: true });

    expect(
      screen.getByRole("button", { name: "登録して続ける" }),
    ).toBeInTheDocument();
  });

  it("金額欄に四則演算が使えるヒントを表示する", () => {
    renderForm();

    expect(screen.getByText("+ − × ÷ で計算できます")).toBeInTheDocument();
    expect(
      (screen.getByLabelText("金額") as HTMLInputElement).placeholder,
    ).toBe("1000");
  });

  it("金額欄に四則演算式を入力すると計算結果のプレビューを表示する", async () => {
    const user = userEvent.setup();
    renderForm();

    const amount = screen.getByLabelText("金額");
    await user.type(amount, "1000+500");

    expect(screen.getByText("= ¥1,500")).toBeInTheDocument();
  });

  it("評価できない式では「計算できません」を表示する", async () => {
    const user = userEvent.setup();
    renderForm();

    const amount = screen.getByLabelText("金額");
    await user.type(amount, "1000+");

    expect(screen.getByText("計算できません")).toBeInTheDocument();
  });

  it("演算子を含まないプレーン数値ではプレビューを出さない", async () => {
    const user = userEvent.setup();
    renderForm();

    const amount = screen.getByLabelText("金額");
    await user.type(amount, "1500");

    expect(screen.queryByText(/= ¥/)).not.toBeInTheDocument();
    expect(screen.queryByText("計算できません")).not.toBeInTheDocument();
  });

  it("「登録して続ける」成功後は金額・メモ・カテゴリをクリアし日付は維持する", async () => {
    const user = userEvent.setup();
    const action = async (): Promise<TransactionActionState> => ({
      ok: true,
      key: Math.random().toString(),
    });
    renderForm({ action, enableContinue: true });

    const amount = screen.getByLabelText("金額") as HTMLInputElement;
    const memo = screen.getByLabelText("メモ") as HTMLTextAreaElement;
    const date = screen.getByLabelText("日付") as HTMLInputElement;
    const dateValue = date.value;

    await user.type(amount, "1500");
    await user.type(memo, "ランチ");
    await user.click(screen.getByRole("radio", { name: "食費" }));

    await user.click(screen.getByRole("button", { name: "登録して続ける" }));

    await waitFor(() => {
      expect(amount.value).toBe("");
    });
    expect(memo.value).toBe("");
    expect(date.value).toBe(dateValue);
    expect(
      (screen.getByRole("radio", { name: "未選択" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
});
