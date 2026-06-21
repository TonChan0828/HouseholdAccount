import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("タイトルを h1 として描画する", () => {
    render(<PageHeader title="ダッシュボード" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "ダッシュボード" }),
    ).toBeInTheDocument();
  });

  it("eyebrow と actions を描画する", () => {
    render(
      <PageHeader
        eyebrow="ホーム"
        title="ダッシュボード"
        actions={<button>記録する</button>}
      />,
    );
    expect(screen.getByText("ホーム")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "記録する" }),
    ).toBeInTheDocument();
  });

  it("meta をタイトル下に描画する", () => {
    render(<PageHeader title="収支" meta="3件の記録" />);
    expect(screen.getByText("3件の記録")).toBeInTheDocument();
  });
});
