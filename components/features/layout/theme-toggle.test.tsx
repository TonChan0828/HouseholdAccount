import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ThemeMenuItems, ThemeToggleButton } from "./theme-toggle";

function renderMenuItems() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <DropdownMenu>
        <DropdownMenuTrigger>メニュー</DropdownMenuTrigger>
        <DropdownMenuContent>
          <ThemeMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark", "light");
});

describe("ThemeMenuItems", () => {
  it("ライト・ダーク・システムの3項目を表示する", async () => {
    const user = userEvent.setup();
    renderMenuItems();

    await user.click(screen.getByRole("button", { name: "メニュー" }));

    expect(
      await screen.findByRole("menuitemradio", { name: "ライト" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "ダーク" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "システム" }),
    ).toBeInTheDocument();
  });

  it("ダークを選択すると html に dark クラスが付与され localStorage に保存される", async () => {
    const user = userEvent.setup();
    renderMenuItems();

    await user.click(screen.getByRole("button", { name: "メニュー" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "ダーク" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("ライトを選択すると dark クラスが外れる", async () => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
    const user = userEvent.setup();
    renderMenuItems();

    await user.click(screen.getByRole("button", { name: "メニュー" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "ライト" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
  });
});

describe("ThemeToggleButton", () => {
  it("ボタンを開いてテーマを選択できる", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggleButton />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "テーマを切り替え" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "ダーク" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
