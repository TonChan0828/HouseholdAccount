import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DeleteHouseholdDialog } from "./delete-household-dialog";

const noop = async () => undefined;

const baseProps = {
  householdId: "h1",
  householdName: "わが家",
  memberCount: 1,
  deleteAction: noop,
};

describe("DeleteHouseholdDialog", () => {
  it("初期状態では確認本文は表示されず、トリガーのみ表示される", () => {
    render(<DeleteHouseholdDialog {...baseProps} />);
    expect(
      screen.getByRole("button", { name: "グループを削除" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "削除する" }),
    ).not.toBeInTheDocument();
  });

  it("トリガーを押すとモーダルでグループ名と削除・キャンセルが表示される", async () => {
    const user = userEvent.setup();
    render(<DeleteHouseholdDialog {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "グループを削除" }));

    expect(await screen.findByText(/わが家/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "削除する" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "キャンセル" }),
    ).toBeInTheDocument();
  });

  it("削除フォームに household_id を渡す", async () => {
    const user = userEvent.setup();
    const { container } = render(<DeleteHouseholdDialog {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "グループを削除" }));
    await screen.findByRole("button", { name: "削除する" });

    const hidden = container.ownerDocument.querySelector(
      'input[name="household_id"]',
    ) as HTMLInputElement | null;
    expect(hidden?.value).toBe("h1");
  });

  it("自分以外のメンバーがいる場合は他メンバーのデータ削除を警告する", async () => {
    const user = userEvent.setup();
    render(<DeleteHouseholdDialog {...baseProps} memberCount={3} />);
    await user.click(screen.getByRole("button", { name: "グループを削除" }));

    expect(await screen.findByText(/あなた以外の\s*2\s*人/)).toBeInTheDocument();
  });

  it("単独メンバーのときは他メンバー警告を出さない", async () => {
    const user = userEvent.setup();
    render(<DeleteHouseholdDialog {...baseProps} memberCount={1} />);
    await user.click(screen.getByRole("button", { name: "グループを削除" }));
    await screen.findByRole("button", { name: "削除する" });

    expect(screen.queryByText(/あなた以外の/)).not.toBeInTheDocument();
  });
});
