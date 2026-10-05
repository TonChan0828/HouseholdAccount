import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ViewToggle } from "./view-toggle";

describe("ViewToggle", () => {
  it("リスト・カレンダーの両ビューへのリンクを表示する", () => {
    render(<ViewToggle active="list" />);
    expect(screen.getByRole("link", { name: "リスト" })).toHaveAttribute(
      "href",
      "/transactions",
    );
    expect(screen.getByRole("link", { name: "カレンダー" })).toHaveAttribute(
      "href",
      "/calendar",
    );
  });

  it("アクティブなビューに aria-current を付ける", () => {
    render(<ViewToggle active="calendar" />);
    expect(screen.getByRole("link", { name: "カレンダー" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "リスト" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("現在表示中の日付をリスト・カレンダー間で引き継ぐ", () => {
    render(<ViewToggle active="list" currentRef="2026-07-20" />);
    expect(screen.getByRole("link", { name: "リスト" })).toHaveAttribute(
      "href",
      "/transactions?ref=2026-07-20",
    );
    expect(screen.getByRole("link", { name: "カレンダー" })).toHaveAttribute(
      "href",
      "/calendar?ref=2026-07-20",
    );
  });

  it("ref がない場合は従来どおりクエリなしのリンクを使う", () => {
    render(<ViewToggle active="calendar" />);
    expect(screen.getByRole("link", { name: "リスト" })).toHaveAttribute(
      "href",
      "/transactions",
    );
    expect(screen.getByRole("link", { name: "カレンダー" })).toHaveAttribute(
      "href",
      "/calendar",
    );
  });
});

it("表示切り替えで全絞り込み条件を引き継ぐ", () => {
  const filter = { type: "expense" as const, categoryId: "category", createdBy: "member", memoQuery: "食費 & 日用品", minAmount: 0, maxAmount: 1000 };
  render(<ViewToggle active="list" currentRef="2026-10-01" filter={filter} />);
  for (const name of ["リスト", "カレンダー"]) {
    const params = new URL(screen.getByRole("link", { name }).getAttribute("href")!, "http://local").searchParams;
    expect(Object.fromEntries(params)).toEqual({ ref: "2026-10-01", type: "expense", category: "category", member: "member", q: "食費 & 日用品", min: "0", max: "1000" });
  }
});
