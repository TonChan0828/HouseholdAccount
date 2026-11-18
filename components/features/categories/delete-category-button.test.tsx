import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteCategoryButton } from "./delete-category-button";

const mocks = vi.hoisted(() => ({ rethrow: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: mocks.rethrow }));

beforeEach(() => {
  vi.resetAllMocks();
});

async function openDialog(action = vi.fn().mockResolvedValue(undefined)) {
  const user = userEvent.setup();
  render(
    <DeleteCategoryButton action={action} categoryId="cat-1" categoryName="ペット" />,
  );
  await user.click(screen.getByRole("button", { name: "ペットを削除" }));
  return { user, action };
}

describe("DeleteCategoryButton", () => {
  it("確認ダイアログで対象と影響を示し、キャンセルでは削除しない", async () => {
    const { user, action } = await openDialog();

    const dialog = screen.getByRole("dialog", { name: "カテゴリを削除しますか？" });
    expect(dialog).toHaveTextContent("ペット");
    expect(dialog).toHaveTextContent(
      "このカテゴリを使用している収支は「未選択」に変更されます。",
    );

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(action).not.toHaveBeenCalled();
  });

  it("「削除する」で対象 id を送信する", async () => {
    const { user, action } = await openDialog();

    await user.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe("cat-1");
  });

  it("action がエラーを返したらダイアログを開いたままエラーを表示する", async () => {
    const { user } = await openDialog(
      vi.fn().mockResolvedValue({ error: "このカテゴリは削除できませんでした" }),
    );

    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "このカテゴリは削除できませんでした",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("action が例外を投げたら汎用のエラーを表示し、成功扱いにしない", async () => {
    const { user } = await openDialog(vi.fn().mockRejectedValue(new Error("network")));

    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "カテゴリの削除に失敗しました。時間をおいて再度お試しください。",
    );
    expect(mocks.rethrow).toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
