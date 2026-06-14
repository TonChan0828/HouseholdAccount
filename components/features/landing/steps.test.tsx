import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Steps } from "./steps";

describe("Steps", () => {
  it("3つのステップを表示する", () => {
    render(<Steps />);

    expect(screen.getByText("アカウント登録")).toBeInTheDocument();
    expect(screen.getByText("グループを作成")).toBeInTheDocument();
    expect(screen.getByText("記録をはじめる")).toBeInTheDocument();
  });
});
