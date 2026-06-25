import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { RecurringActionState } from "@/app/(dashboard)/transactions/recurring/actions";
import type { Category } from "@/types";

import { RecurringForm } from "./recurring-form";

const noop = async () => undefined;

const categories: Category[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    household_id: "h1",
    name: "固定費",
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
    state: RecurringActionState,
    formData: FormData,
  ) => Promise<RecurringActionState>;
  defaultValues?: Parameters<typeof RecurringForm>[0]["defaultValues"];
}) {
  return render(
    <RecurringForm
      action={props?.action ?? noop}
      categories={categories}
      submitLabel="登録する"
      defaultValues={props?.defaultValues}
    />,
  );
}

describe("RecurringForm", () => {
  it("金額・カテゴリ・メモ・自動生成トグルと送信ボタンを表示する", () => {
    renderForm();

    expect(screen.getByLabelText("金額")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "カテゴリ" })).toBeInTheDocument();
    expect(screen.getByLabelText("メモ")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /自動生成を有効にする/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登録する" }),
    ).toBeInTheDocument();
  });

  it("日付欄は持たない（登録日は household のスタート日に従う）", () => {
    renderForm();
    expect(screen.queryByLabelText("日付")).not.toBeInTheDocument();
  });

  it("既定では自動生成が有効（チェック済み）", () => {
    renderForm();
    expect(
      (screen.getByRole("checkbox", { name: /自動生成/ }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it("収入に切り替えると収入カテゴリのチップに入れ替わる", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "収入" }));

    expect(screen.getByRole("radio", { name: "給与" })).toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "固定費" }),
    ).not.toBeInTheDocument();
  });

  it("金額欄に四則演算式を入力すると計算結果のプレビューを表示する", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("金額"), "5000+480");

    expect(screen.getByText("= ¥5,480")).toBeInTheDocument();
  });

  it("defaultValues で無効状態を反映する", () => {
    renderForm({ defaultValues: { is_active: false } });
    expect(
      (screen.getByRole("checkbox", { name: /自動生成/ }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });
});
