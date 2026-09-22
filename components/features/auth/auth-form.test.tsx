import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

describe("AuthForm", () => {
  it("認証後の戻り先を hidden input に保持する", () => {
    render(
      <AuthForm
        title="ログイン"
        description="説明"
        submitLabel="ログイン"
        action={vi.fn()}
        altText="未登録なら"
        altHref="/register?next=%2Finvite%2Ftoken"
        altLinkLabel="新規登録"
        nextPath="/invite/token"
      />,
    );

    expect(screen.getByDisplayValue("/invite/token")).toHaveAttribute(
      "name",
      "next",
    );
    expect(screen.getByRole("link", { name: "新規登録" })).toHaveAttribute(
      "href",
      "/register?next=%2Finvite%2Ftoken",
    );
  });
});
