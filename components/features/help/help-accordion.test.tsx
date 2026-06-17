import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HelpAccordion } from "./help-accordion";
import { HELP_SECTIONS } from "./help-content";

describe("HelpAccordion", () => {
  it("全セクションのタイトルを表示する", () => {
    render(<HelpAccordion />);

    for (const section of HELP_SECTIONS) {
      expect(
        screen.getByRole("button", { name: new RegExp(section.title) }),
      ).toBeInTheDocument();
    }
  });

  it("トリガーをクリックすると操作手順が開く", async () => {
    const user = userEvent.setup();
    render(<HelpAccordion />);

    const target = HELP_SECTIONS[0];
    await user.click(
      screen.getByRole("button", { name: new RegExp(target.title) }),
    );

    expect(screen.getByText(target.steps[0])).toBeVisible();
  });
});
