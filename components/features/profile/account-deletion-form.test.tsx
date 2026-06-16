import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AccountDeletionForm } from "./account-deletion-form";

const noop = async () => undefined;

function renderForm(email = "me@example.com") {
  return render(<AccountDeletionForm action={noop} email={email} />);
}

describe("AccountDeletionForm", () => {
  it("確認用の入力欄と削除ボタンを表示する", () => {
    renderForm();

    expect(
      screen.getByLabelText("確認のためメールアドレスを入力"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "アカウントを削除する" }),
    ).toBeInTheDocument();
  });

  it("入力がメールアドレスと一致するまで削除ボタンは無効", () => {
    renderForm();

    expect(
      screen.getByRole("button", { name: "アカウントを削除する" }),
    ).toBeDisabled();
  });

  it("一致しない入力では削除ボタンは無効のまま", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByLabelText("確認のためメールアドレスを入力"),
      "wrong@example.com",
    );

    expect(
      screen.getByRole("button", { name: "アカウントを削除する" }),
    ).toBeDisabled();
  });

  it("メールアドレスを正しく入力すると削除ボタンが有効になる", async () => {
    const user = userEvent.setup();
    renderForm("me@example.com");

    await user.type(
      screen.getByLabelText("確認のためメールアドレスを入力"),
      "me@example.com",
    );

    expect(
      screen.getByRole("button", { name: "アカウントを削除する" }),
    ).toBeEnabled();
  });
});
