import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./forgot-password-form";

describe("ForgotPasswordForm", () => {
  it("メール入力欄と送信ボタンを表示する", () => {
    render(<ForgotPasswordForm action={vi.fn()} />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "再設定メールを送信" }),
    ).toBeInTheDocument();
  });

  it("送信すると action が呼ばれる", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ success: true });
    render(<ForgotPasswordForm action={action} />);

    await user.type(screen.getByLabelText("メールアドレス"), "a@example.com");
    await user.click(
      screen.getByRole("button", { name: "再設定メールを送信" }),
    );

    expect(action).toHaveBeenCalled();
  });

  it("成功時に role=status で案内を表示する", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ success: true });
    render(<ForgotPasswordForm action={action} />);

    await user.type(screen.getByLabelText("メールアドレス"), "a@example.com");
    await user.click(
      screen.getByRole("button", { name: "再設定メールを送信" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "パスワード再設定用のメールを送信しました",
    );
  });

  it("エラー時に role=alert でメッセージを表示する", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockResolvedValue({ error: "有効なメールアドレスを入力してください" });
    render(<ForgotPasswordForm action={action} />);

    await user.type(screen.getByLabelText("メールアドレス"), "a@example.com");
    await user.click(
      screen.getByRole("button", { name: "再設定メールを送信" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "有効なメールアドレスを入力してください",
    );
  });
});
