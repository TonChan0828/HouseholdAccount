import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import DashboardError from "./error";

describe("DashboardError", () => {
  it("障害メッセージを表示して再試行できる", async () => {
    const retry = vi.fn();
    render(
      <DashboardError error={new Error("detail")} unstable_retry={retry} />,
    );

    expect(screen.getByRole("heading", { name: "データを読み込めませんでした" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText("detail")).not.toBeInTheDocument();
  });
});
