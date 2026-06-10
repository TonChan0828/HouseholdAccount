import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CATEGORY_COLORS } from "@/lib/validations/category";

import { CategoryForm } from "./category-form";

const noopAction = vi.fn();

describe("CategoryForm", () => {
  it("名前・色・種別の入力欄を表示する", () => {
    render(<CategoryForm action={noopAction} submitLabel="追加する" />);

    expect(screen.getByLabelText("カテゴリ名")).toBeInTheDocument();
    // 色パレット12色のラジオ
    expect(screen.getAllByRole("radio", { name: /^色: / })).toHaveLength(12);
    // 種別の3択
    expect(screen.getByRole("radio", { name: "支出" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "収入" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "両方" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "追加する" }),
    ).toBeInTheDocument();
  });

  it("初期値（編集時）を反映する", () => {
    render(
      <CategoryForm
        action={noopAction}
        submitLabel="更新する"
        defaultValues={{
          id: "cat-1",
          name: "ペット",
          color: CATEGORY_COLORS[3],
          type: "both",
        }}
      />,
    );

    expect(screen.getByLabelText("カテゴリ名")).toHaveValue("ペット");
    expect(screen.getByRole("radio", { name: "両方" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: `色: ${CATEGORY_COLORS[3]}` }),
    ).toBeChecked();
  });
});
