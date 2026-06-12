import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileForm } from "./profile-form";

describe("ProfileForm", () => {
  it("表示名の入力欄に現在の表示名を初期表示する", () => {
    render(<ProfileForm action={vi.fn()} defaultDisplayName="たろう" />);

    expect(screen.getByLabelText("表示名")).toHaveValue("たろう");
    expect(
      screen.getByRole("button", { name: "保存する" }),
    ).toBeInTheDocument();
  });

  it("送信すると action が呼ばれる", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm action={action} defaultDisplayName="たろう" />);

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(action).toHaveBeenCalled();
  });

  it("エラー時に role=alert でメッセージを表示する", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockResolvedValue({ error: "表示名を入力してください" });
    render(<ProfileForm action={action} defaultDisplayName="たろう" />);

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "表示名を入力してください",
    );
  });

  it("成功時に role=status で成功メッセージを表示する", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ success: true });
    render(<ProfileForm action={action} defaultDisplayName="たろう" />);

    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "表示名を更新しました",
    );
  });
});
