import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UnrecordedCategoriesReminderCard } from "./unrecorded-categories-reminder-card";

describe("UnrecordedCategoriesReminderCard", () => {
  it("未登録カテゴリ名を列挙する", () => {
    render(
      <UnrecordedCategoriesReminderCard
        categories={[
          { id: "c1", name: "家賃" },
          { id: "c2", name: "給与" },
        ]}
        newTransactionHref="/transactions/new"
      />,
    );
    const card = screen.getByTestId("unrecorded-categories-reminder");
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent("家賃");
    expect(card).toHaveTextContent("給与");
    expect(card).toHaveTextContent("まだ登録がありません");
  });

  it("「収支を記録」CTAが newTransactionHref を指す", () => {
    render(
      <UnrecordedCategoriesReminderCard
        categories={[{ id: "c1", name: "家賃" }]}
        newTransactionHref="/transactions/new?date=2026-07-31"
      />,
    );
    expect(screen.getByRole("link", { name: "収支を記録" })).toHaveAttribute(
      "href",
      "/transactions/new?date=2026-07-31",
    );
  });
});
