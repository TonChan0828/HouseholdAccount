import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GroupDisclosure } from "./group-disclosure";

function renderDisclosure() {
  return render(
    <GroupDisclosure label="管理（メンバー2人）">
      <p>メンバー一覧の中身</p>
    </GroupDisclosure>,
  );
}

describe("GroupDisclosure", () => {
  it("既定では折り畳まれ、中身を表示しない", () => {
    renderDisclosure();
    expect(
      screen.getByRole("button", { name: "管理（メンバー2人）" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("メンバー一覧の中身")).not.toBeInTheDocument();
  });

  it("トグルをクリックすると中身を表示し、再クリックで閉じる", async () => {
    const user = userEvent.setup();
    renderDisclosure();

    const toggle = screen.getByRole("button", { name: "管理（メンバー2人）" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("メンバー一覧の中身")).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("メンバー一覧の中身")).not.toBeInTheDocument();
  });
});
