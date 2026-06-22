import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MemberList, type MemberListItem } from "./member-list";

const noop = async () => undefined;
const noopState = async () => undefined;

const ownerSelf: MemberListItem = {
  user_id: "u1",
  display_name: "オーナー太郎",
  role: "owner",
  joined_at: "2026-06-01T00:00:00Z",
  isSelf: true,
};
const memberOther: MemberListItem = {
  user_id: "u2",
  display_name: "メンバー花子",
  role: "member",
  joined_at: "2026-06-05T00:00:00Z",
  isSelf: false,
};

const baseProps = {
  householdId: "h1",
  members: [ownerSelf, memberOther],
  viewerIsOwner: true,
  removeAction: noop,
  leaveAction: noopState,
  transferAction: noop,
  updateNameAction: noop,
};

describe("MemberList", () => {
  it("メンバーの表示名・オーナーバッジ・自分の印を表示する", () => {
    render(<MemberList {...baseProps} />);
    expect(screen.getByText("オーナー太郎")).toBeInTheDocument();
    expect(screen.getByText("メンバー花子")).toBeInTheDocument();
    // オーナーのロールバッジ（表示名 "オーナー太郎" とは別の完全一致ノード）
    expect(screen.getByText("オーナー", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("あなた")).toBeInTheDocument();
  });

  it("オーナーには他メンバーの委譲・除外操作が表示される", () => {
    render(<MemberList {...baseProps} />);
    expect(
      screen.getByRole("button", { name: "オーナーを委譲" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "除外" })).toBeInTheDocument();
  });

  it("一般メンバーには委譲・除外は表示されず、自分の行に脱退が出る", () => {
    render(
      <MemberList
        {...baseProps}
        viewerIsOwner={false}
        members={[
          { ...ownerSelf, isSelf: false },
          { ...memberOther, isSelf: true },
        ]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "オーナーを委譲" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "除外" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "脱退" })).toBeInTheDocument();
  });

  it("自分がオーナーのときは脱退ボタンを出さず委譲を促す", () => {
    render(<MemberList {...baseProps} />);
    expect(
      screen.queryByRole("button", { name: "脱退" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/委譲してから脱退/)).toBeInTheDocument();
  });

  it("除外は確認ステップを挟んでから実行できる", async () => {
    const user = userEvent.setup();
    render(<MemberList {...baseProps} />);
    // 確認前は実行ボタンが無い
    expect(
      screen.queryByRole("button", { name: "除外する" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "除外" }));
    // 確認後に実行ボタン（submit）が現れる
    expect(
      screen.getByRole("button", { name: "除外する" }),
    ).toBeInTheDocument();
    // キャンセルで戻せる
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(
      screen.queryByRole("button", { name: "除外する" }),
    ).not.toBeInTheDocument();
  });

  it("委譲は確認ステップを挟んでから実行できる", async () => {
    const user = userEvent.setup();
    render(<MemberList {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "オーナーを委譲" }));
    expect(
      screen.getByRole("button", { name: "委譲する" }),
    ).toBeInTheDocument();
  });

  it("自分の行にニックネーム編集が出て、編集フォームを開ける", async () => {
    const user = userEvent.setup();
    render(
      <MemberList
        {...baseProps}
        members={[
          { ...ownerSelf, groupDisplayName: "パパ" },
          memberOther,
        ]}
      />,
    );
    // 自分の行は1つなので編集ボタンも1つ
    const editButtons = screen.getAllByRole("button", {
      name: "ニックネーム編集",
    });
    expect(editButtons).toHaveLength(1);

    await user.click(editButtons[0]);
    const input = screen.getByLabelText("このグループでの表示名");
    expect(input).toHaveValue("パパ");
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();

    // キャンセルで閉じる
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(
      screen.queryByLabelText("このグループでの表示名"),
    ).not.toBeInTheDocument();
  });

  it("他メンバーの行にはニックネーム編集を出さない", () => {
    render(
      <MemberList
        {...baseProps}
        viewerIsOwner={false}
        members={[{ ...memberOther, isSelf: false }]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "ニックネーム編集" }),
    ).not.toBeInTheDocument();
  });
});
