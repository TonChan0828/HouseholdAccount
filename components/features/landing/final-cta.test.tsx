import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinalCta } from "./final-cta";

describe("FinalCta", () => {
  it("登録への CTA リンクを持つ", () => {
    render(<FinalCta />);

    expect(
      screen.getByRole("link", { name: /無料で始める/ }),
    ).toHaveAttribute("href", "/register");
  });
});
