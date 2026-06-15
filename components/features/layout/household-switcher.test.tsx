import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HouseholdSwitcher } from "./household-switcher";

const HOUSEHOLDS = [
  { id: "h1", name: "わが家" },
  { id: "h2", name: "シェアハウス" },
  { id: "h3", name: "実家" },
];

function renderSwitcher(switchAction = vi.fn()) {
  return render(
    <HouseholdSwitcher
      households={HOUSEHOLDS}
      activeId="h1"
      switchAction={switchAction}
    />,
  );
}

describe("HouseholdSwitcher", () => {
  it("トリガーに現在のグループ名を表示する", () => {
    renderSwitcher();

    expect(
      screen.getByRole("button", { name: /わが家/ }),
    ).toBeInTheDocument();
  });

  it("開くと所属グループがすべて表示される", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(screen.getByRole("button", { name: /わが家/ }));

    expect(
      await screen.findByRole("menuitem", { name: /シェアハウス/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /実家/ }),
    ).toBeInTheDocument();
  });

  it("別グループを選ぶと switchAction が household_id 付きで呼ばれる", async () => {
    const user = userEvent.setup();
    const switchAction = vi.fn();
    renderSwitcher(switchAction);

    await user.click(screen.getByRole("button", { name: /わが家/ }));
    await user.click(
      await screen.findByRole("menuitem", { name: /シェアハウス/ }),
    );

    expect(switchAction).toHaveBeenCalledTimes(1);
    const formData = switchAction.mock.calls[0][0] as FormData;
    expect(formData.get("household_id")).toBe("h2");
  });

  it("現在のグループを選んでも切り替えは実行されない", async () => {
    const user = userEvent.setup();
    const switchAction = vi.fn();
    renderSwitcher(switchAction);

    await user.click(screen.getByRole("button", { name: /わが家/ }));
    await user.click(
      await screen.findByRole("menuitem", { name: /わが家/ }),
    );

    expect(switchAction).not.toHaveBeenCalled();
  });

  it("グループ名の長さによらず一律な幅で truncate 表示する", async () => {
    const user = userEvent.setup();
    const longName =
      "とてもながいかぞくのグループめいですよこれはほんとうにながいなまえ";
    render(
      <HouseholdSwitcher
        households={[
          { id: "h1", name: longName },
          { id: "h2", name: "シェアハウス" },
        ]}
        activeId="h1"
        switchAction={vi.fn()}
      />,
    );

    // トリガーは固定幅（w-36/sm:w-44）で、名前は truncate して省略する
    const trigger = screen.getByRole("button", { name: /とてもながい/ });
    expect(trigger.className).toMatch(/\bw-36\b/);
    expect(trigger.className).toMatch(/sm:w-44/);
    expect(screen.getByText(longName).className).toMatch(/truncate/);

    // メニュー内のグループ名も truncate（flex 内で縮むよう min-w-0）する
    await user.click(trigger);
    const menuName = await screen.findByText("シェアハウス");
    expect(menuName.className).toMatch(/truncate/);
    expect(menuName.className).toMatch(/min-w-0/);
  });

  it("グループ管理ページへのリンクを表示する", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(screen.getByRole("button", { name: /わが家/ }));

    expect(
      await screen.findByRole("menuitem", { name: /グループを管理/ }),
    ).toHaveAttribute("href", "/households");
  });
});
