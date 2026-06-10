import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteCategoryButton } from "./delete-category-button";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DeleteCategoryButton", () => {
  it("confirm でキャンセルすると action を実行しない", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const action = vi.fn();
    render(<DeleteCategoryButton action={action} categoryId="cat-1" />);

    await userEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  it("confirm を承諾すると action を実行する", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const action = vi.fn();
    render(<DeleteCategoryButton action={action} categoryId="cat-1" />);

    await userEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(action).toHaveBeenCalled();
  });
});
