import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoTransactionsReminderCard } from "./no-transactions-reminder-card";

describe("NoTransactionsReminderCard", () => {
  it("残り日数を含む文言を表示する", () => {
    render(
      <NoTransactionsReminderCard
        daysRemaining={2}
        newTransactionHref="/transactions/new"
      />,
    );
    expect(screen.getByTestId("no-transactions-reminder")).toBeInTheDocument();
    expect(screen.getByText(/残り2日/)).toBeInTheDocument();
  });

  it("「収支を記録」CTAが newTransactionHref を指す", () => {
    render(
      <NoTransactionsReminderCard
        daysRemaining={0}
        newTransactionHref="/transactions/new?date=2026-07-31"
      />,
    );
    expect(screen.getByRole("link", { name: "収支を記録" })).toHaveAttribute(
      "href",
      "/transactions/new?date=2026-07-31",
    );
  });
});
