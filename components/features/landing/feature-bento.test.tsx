import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeatureBento } from "./feature-bento";

describe("FeatureBento", () => {
  it("6つの機能ラベルをすべて表示する", () => {
    render(<FeatureBento />);

    for (const label of [
      "グループ共有",
      "収支記録",
      "月次分析",
      "メンバー別アクティビティ",
      "カテゴリ管理",
      "ダークモード",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
