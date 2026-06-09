import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CreateHouseholdForm } from "./create-household-form";

describe("CreateHouseholdForm", () => {
  const noop = async () => undefined;

  it("グループ名の入力欄と作成ボタンを表示する", () => {
    render(<CreateHouseholdForm action={noop} />);
    expect(screen.getByLabelText("グループ名")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "グループを作成" }),
    ).toBeInTheDocument();
  });
});
