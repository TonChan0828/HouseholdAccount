import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HouseholdInvitation } from "@/types";

import { InvitationManager } from "./invitation-manager";

const noopState = async () => undefined;
const noop = async () => undefined;

const baseProps = {
  householdId: "h1",
  invitations: [] as HouseholdInvitation[],
  createAction: noopState,
  updateAction: noop,
  revokeAction: noop,
};

const sampleInvitation: HouseholdInvitation = {
  id: "inv1",
  household_id: "h1",
  token: "tok_abc",
  created_by: "u1",
  max_uses: 3,
  uses_count: 1,
  expires_at: null,
  created_at: "2026-06-09T00:00:00Z",
};

describe("InvitationManager", () => {
  it("人数上限の入力欄と発行ボタンを表示する", () => {
    render(<InvitationManager {...baseProps} />);
    expect(screen.getByLabelText("参加できる人数")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "招待リンクを発行" }),
    ).toBeInTheDocument();
  });

  it("発行済みの招待には残り人数と失効ボタンを表示する", () => {
    render(
      <InvitationManager {...baseProps} invitations={[sampleInvitation]} />,
    );
    // 残り 2 / 上限 3 を表す表示
    expect(screen.getByText(/残り\s*2/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "失効" }),
    ).toBeInTheDocument();
  });

  describe("招待リンクの共有", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      // navigator.share をテスト間で持ち越さない
      // @ts-expect-error テスト用クリーンアップ
      delete navigator.share;
    });

    it("LINE 共有リンクが招待URLをエンコードして含む", () => {
      render(
        <InvitationManager {...baseProps} invitations={[sampleInvitation]} />,
      );
      const lineLink = screen.getByRole("link", { name: "LINEで共有" });
      expect(lineLink).toHaveAttribute(
        "href",
        expect.stringContaining("social-plugins.line.me/lineit/share"),
      );
      expect(lineLink.getAttribute("href")).toContain("%2Finvite%2Ftok_abc");
      expect(lineLink).toHaveAttribute("target", "_blank");
    });

    it("コピーボタンで招待URLをクリップボードに書き込む", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      render(
        <InvitationManager {...baseProps} invitations={[sampleInvitation]} />,
      );
      await userEvent.click(screen.getByRole("button", { name: "コピー" }));
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("/invite/tok_abc"),
      );
    });

    it("navigator.share 対応時はネイティブ共有ボタンを表示しクリックで呼び出す", async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", {
        value: share,
        configurable: true,
        writable: true,
      });
      render(
        <InvitationManager {...baseProps} invitations={[sampleInvitation]} />,
      );
      const shareButton = screen.getByRole("button", { name: "共有" });
      await userEvent.click(shareButton);
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("/invite/tok_abc"),
        }),
      );
    });

    it("navigator.share 非対応時はネイティブ共有ボタンを表示しない", () => {
      render(
        <InvitationManager {...baseProps} invitations={[sampleInvitation]} />,
      );
      expect(
        screen.queryByRole("button", { name: "共有" }),
      ).not.toBeInTheDocument();
    });
  });
});
