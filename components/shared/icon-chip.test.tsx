import { render, screen } from "@testing-library/react";
import { PiggyBank } from "lucide-react";
import { describe, expect, it } from "vitest";

import { IconChip } from "./icon-chip";

describe("IconChip", () => {
  it("label を aria ラベルとして公開する", () => {
    render(<IconChip icon={PiggyBank} label="貯蓄" />);
    expect(screen.getByLabelText("貯蓄")).toBeInTheDocument();
  });

  it("tone=income で income 配色クラスを付ける", () => {
    render(<IconChip icon={PiggyBank} label="収入" tone="income" />);
    expect(screen.getByLabelText("収入")).toHaveClass("text-income");
  });
});
