import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "./reset-password-form";

describe("ResetPasswordForm", () => {
  it("新しいパスワードと確認の入力欄を表示する", () => {
    render(<ResetPasswordForm action={vi.fn()} />);

    expect(screen.getByLabelText("新しいパスワード")).toBeInTheDocument();
    expect(screen.getByLabelText("新しいパスワード（確認）")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "パスワードを設定" }),
    ).toBeInTheDocument();
  });

  it("送信すると action が呼ばれる", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue(undefined);
    render(<ResetPasswordForm action={action} />);

    await user.type(screen.getByLabelText("新しいパスワード"), "secret123");
    await user.type(
      screen.getByLabelText("新しいパスワード（確認）"),
      "secret123",
    );
    await user.click(screen.getByRole("button", { name: "パスワードを設定" }));

    expect(action).toHaveBeenCalled();
  });

  it("エラー時に role=alert でメッセージを表示する", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockResolvedValue({ error: "パスワードが一致しません" });
    render(<ResetPasswordForm action={action} />);

    await user.type(screen.getByLabelText("新しいパスワード"), "secret123");
    await user.type(
      screen.getByLabelText("新しいパスワード（確認）"),
      "secret124",
    );
    await user.click(screen.getByRole("button", { name: "パスワードを設定" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "パスワードが一致しません",
    );
  });
});
