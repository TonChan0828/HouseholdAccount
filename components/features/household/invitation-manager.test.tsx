import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

describe("InvitationManager", () => {
  it("人数上限の入力欄と発行ボタンを表示する", () => {
    render(<InvitationManager {...baseProps} />);
    expect(screen.getByLabelText("参加できる人数")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "招待リンクを発行" }),
    ).toBeInTheDocument();
  });

  it("発行済みの招待には残り人数と失効ボタンを表示する", () => {
    const invitations: HouseholdInvitation[] = [
      {
        id: "inv1",
        household_id: "h1",
        token: "tok_abc",
        created_by: "u1",
        max_uses: 3,
        uses_count: 1,
        expires_at: null,
        created_at: "2026-06-09T00:00:00Z",
      },
    ];
    render(<InvitationManager {...baseProps} invitations={invitations} />);
    // 残り 2 / 上限 3 を表す表示
    expect(screen.getByText(/残り\s*2/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "失効" }),
    ).toBeInTheDocument();
  });
});
