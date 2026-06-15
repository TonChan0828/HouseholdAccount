import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PasswordForm } from "./password-form";

describe("PasswordForm", () => {
  it("新しいパスワードと確認の入力欄・ボタンを表示する", () => {
    render(<PasswordForm action={vi.fn()} />);

    expect(screen.getByLabelText("新しいパスワード")).toBeInTheDocument();
    expect(screen.getByLabelText("新しいパスワード（確認）")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "変更する" }),
    ).toBeInTheDocument();
  });

  it("送信すると action が呼ばれる", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ success: true });
    render(<PasswordForm action={action} />);

    await user.type(screen.getByLabelText("新しいパスワード"), "secret123");
    await user.type(
      screen.getByLabelText("新しいパスワード（確認）"),
      "secret123",
    );
    await user.click(screen.getByRole("button", { name: "変更する" }));

    expect(action).toHaveBeenCalled();
  });

  it("エラー時に role=alert でメッセージを表示する", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockResolvedValue({ error: "パスワードが一致しません" });
    render(<PasswordForm action={action} />);

    await user.type(screen.getByLabelText("新しいパスワード"), "secret123");
    await user.type(
      screen.getByLabelText("新しいパスワード（確認）"),
      "secret124",
    );
    await user.click(screen.getByRole("button", { name: "変更する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "パスワードが一致しません",
    );
  });

  it("成功時に role=status で成功メッセージを表示する", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ success: true });
    render(<PasswordForm action={action} />);

    await user.type(screen.getByLabelText("新しいパスワード"), "secret123");
    await user.type(
      screen.getByLabelText("新しいパスワード（確認）"),
      "secret123",
    );
    await user.click(screen.getByRole("button", { name: "変更する" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "パスワードを変更しました",
    );
  });
});
