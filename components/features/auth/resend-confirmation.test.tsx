import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ResendConfirmation } from "./resend-confirmation";

describe("ResendConfirmation", () => {
  it("再送信ボタンを表示する", () => {
    render(<ResendConfirmation email="me@example.com" action={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "確認メールを再送信" }),
    ).toBeInTheDocument();
  });

  it("送信すると email 付きで action が呼ばれる", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ success: true });
    render(<ResendConfirmation email="me@example.com" action={action} />);

    await user.click(
      screen.getByRole("button", { name: "確認メールを再送信" }),
    );

    expect(action).toHaveBeenCalled();
    const formData = action.mock.calls[0]?.[1] as FormData;
    expect(formData.get("email")).toBe("me@example.com");
  });

  it("成功時に role=status で案内を表示する", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ success: true });
    render(<ResendConfirmation email="me@example.com" action={action} />);

    await user.click(
      screen.getByRole("button", { name: "確認メールを再送信" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "確認メールを再送信しました",
    );
  });

  it("エラー時に role=alert でメッセージを表示する", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ error: "送信に失敗しました" });
    render(<ResendConfirmation email="me@example.com" action={action} />);

    await user.click(
      screen.getByRole("button", { name: "確認メールを再送信" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "送信に失敗しました",
    );
  });
});
