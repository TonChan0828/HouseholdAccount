import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { SheetPreview } from "@/app/(dashboard)/transactions/import/actions";
import type { ClassifyResult } from "@/lib/import/excel";

import { ImportPreview, ImportResult } from "./import-form";

const noop = async () => undefined;

function result(overrides: Partial<ClassifyResult> = {}): ClassifyResult {
  return {
    valid: [
      { type: "income", categoryName: "給料", amount: 316719 },
      { type: "expense", categoryName: "食費", amount: 24224 },
    ],
    skipped: [{ row: 17, item: "イオンカード", reason: "金額が空" }],
    errors: [],
    ...overrides,
  };
}

describe("ImportPreview", () => {
  it("有効行のカテゴリ名と金額を表示する", () => {
    render(
      <ImportPreview month="2026-06" result={result()} confirmAction={noop} />,
    );
    expect(screen.getByText("給料")).toBeInTheDocument();
    expect(screen.getByText("食費")).toBeInTheDocument();
    expect(screen.getByText(/316,719/)).toBeInTheDocument();
  });

  it("スキップ行を理由つきで表示する", () => {
    render(
      <ImportPreview month="2026-06" result={result()} confirmAction={noop} />,
    );
    expect(screen.getByText(/イオンカード/)).toBeInTheDocument();
    expect(screen.getByText(/金額が空/)).toBeInTheDocument();
  });

  it("エラー行を行番号・理由つきで表示する", () => {
    render(
      <ImportPreview
        month="2026-06"
        result={result({
          errors: [{ row: 9, item: "服", reason: "金額は整数で入力してください" }],
        })}
        confirmAction={noop}
      />,
    );
    expect(screen.getByText(/服/)).toBeInTheDocument();
    expect(screen.getByText(/整数/)).toBeInTheDocument();
  });

  it("対象月の初期値を入力欄に反映する", () => {
    render(
      <ImportPreview month="2026-06" result={result()} confirmAction={noop} />,
    );
    expect(screen.getByLabelText("対象月")).toHaveValue("2026-06");
  });

  it("有効行があれば確定ボタンは有効", () => {
    render(
      <ImportPreview month="2026-06" result={result()} confirmAction={noop} />,
    );
    expect(
      screen.getByRole("button", { name: /取り込む/ }),
    ).not.toBeDisabled();
  });

  it("有効行が0件なら確定ボタンは無効", () => {
    render(
      <ImportPreview
        month="2026-06"
        result={result({ valid: [] })}
        confirmAction={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /取り込む/ })).toBeDisabled();
  });
});

function sheet(overrides: Partial<SheetPreview> = {}): SheetPreview {
  return {
    sheet: "2026年06月",
    month: "2026-06",
    result: result({
      valid: [{ type: "expense", categoryName: "食費", amount: 24224 }],
    }),
    ...overrides,
  };
}

describe("ImportResult（シート選択）", () => {
  it("シートが1枚ならセレクタを出さずプレビューを表示する", () => {
    render(<ImportResult sheets={[sheet()]} confirmAction={noop} />);
    expect(screen.queryByLabelText("シート")).not.toBeInTheDocument();
    expect(screen.getByText("食費")).toBeInTheDocument();
  });

  it("シートが複数ならシート名のセレクタを表示する", () => {
    render(
      <ImportResult
        sheets={[
          sheet({ sheet: "2026年06月", month: "2026-06" }),
          sheet({ sheet: "2026年07月", month: "2026-07" }),
        ]}
        confirmAction={noop}
      />,
    );
    const select = screen.getByLabelText("シート");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2026年06月" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2026年07月" })).toBeInTheDocument();
  });

  it("シートを切り替えると対象月と内容が切り替わる", async () => {
    render(
      <ImportResult
        sheets={[
          sheet({
            sheet: "2026年06月",
            month: "2026-06",
            result: result({
              valid: [{ type: "expense", categoryName: "食費", amount: 100 }],
            }),
          }),
          sheet({
            sheet: "2026年07月",
            month: "2026-07",
            result: result({
              valid: [{ type: "income", categoryName: "賞与", amount: 5000 }],
            }),
          }),
        ]}
        confirmAction={noop}
      />,
    );
    // 初期は1枚目
    expect(screen.getByText("食費")).toBeInTheDocument();
    expect(screen.getByLabelText("対象月")).toHaveValue("2026-06");

    await userEvent.selectOptions(screen.getByLabelText("シート"), "2026年07月");
    expect(screen.getByText("賞与")).toBeInTheDocument();
    expect(screen.getByLabelText("対象月")).toHaveValue("2026-07");
  });
});
