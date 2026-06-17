import { describe, expect, it } from "vitest";

import { type ExportRow, toTransactionsCsv } from "@/lib/export";

const BOM = "﻿";

function row(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    date: "2026-06-01",
    type: "expense",
    categoryName: "食費",
    amount: 1200,
    memo: "ランチ",
    memberName: "たろう",
    ...overrides,
  };
}

/** BOM とヘッダーを取り除いた「データ行のみ」を返す。 */
function dataLines(csv: string): string[] {
  return csv.replace(BOM, "").trim().split("\n").slice(1);
}

describe("toTransactionsCsv", () => {
  it("先頭に UTF-8 BOM を付与する", () => {
    expect(toTransactionsCsv([])).toMatch(/^﻿/);
  });

  it("空配列のときはヘッダー行のみを返す", () => {
    const csv = toTransactionsCsv([]);
    expect(csv).toBe(`${BOM}日付,種別,カテゴリ,金額,メモ,登録者`);
  });

  it("ヘッダー行が正しい", () => {
    const csv = toTransactionsCsv([row()]);
    const header = csv.replace(BOM, "").split("\n")[0];
    expect(header).toBe("日付,種別,カテゴリ,金額,メモ,登録者");
  });

  it("種別を 収入/支出 に日本語化する", () => {
    const csv = toTransactionsCsv([
      row({ type: "income" }),
      row({ type: "expense" }),
    ]);
    const [income, expense] = dataLines(csv);
    expect(income.split(",")[1]).toBe("収入");
    expect(expense.split(",")[1]).toBe("支出");
  });

  it("金額は記号なしの数値のみを出力する", () => {
    const csv = toTransactionsCsv([row({ amount: 35000 })]);
    expect(dataLines(csv)[0].split(",")[3]).toBe("35000");
  });

  it("各列が期待どおりの順序で並ぶ", () => {
    const csv = toTransactionsCsv([row()]);
    expect(dataLines(csv)[0]).toBe("2026-06-01,支出,食費,1200,ランチ,たろう");
  });

  it("カテゴリが null のとき 未分類 にする", () => {
    const csv = toTransactionsCsv([row({ categoryName: null })]);
    expect(dataLines(csv)[0].split(",")[2]).toBe("未分類");
  });

  it("登録者が null のとき 不明 にする", () => {
    const csv = toTransactionsCsv([row({ memberName: null })]);
    expect(dataLines(csv)[0].split(",")[5]).toBe("不明");
  });

  it("メモが null のとき空文字にする", () => {
    const csv = toTransactionsCsv([row({ memo: null })]);
    expect(dataLines(csv)[0]).toBe("2026-06-01,支出,食費,1200,,たろう");
  });

  it("カンマを含む値はダブルクオートで囲む", () => {
    const csv = toTransactionsCsv([row({ memo: "ランチ, コーヒー" })]);
    expect(dataLines(csv)[0]).toContain('"ランチ, コーヒー"');
  });

  it("ダブルクオートを含む値はクオートで囲み内部を二重化する", () => {
    const csv = toTransactionsCsv([row({ memo: '彼は "急いで" いた' })]);
    expect(dataLines(csv)[0]).toContain('"彼は ""急いで"" いた"');
  });

  it("改行を含む値はダブルクオートで囲む", () => {
    const csv = toTransactionsCsv([row({ memo: "1行目\n2行目" })]);
    // 改行を含むのでフィールドはクオートされ、行全体としては 2 物理行になる
    expect(csv).toContain('"1行目\n2行目"');
  });

  describe("数式インジェクション対策（CSV formula injection）", () => {
    // 先頭が = + - @ \t \r で始まる値は、Excel/Sheets で数式として実行されうる。
    // 先頭に ' を付与して無害化する（RFC4180 のクオート判定はその後に適用）。
    it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\t=cmd"])(
      "危険な先頭文字を持つメモ %j は先頭に ' を付与して無害化する",
      (memo) => {
        const csv = toTransactionsCsv([row({ memo })]);
        expect(dataLines(csv)[0].split(",")[4]).toBe(`'${memo}`);
      },
    );

    it("先頭が \\r の値は無害化したうえでクオートする（改行扱い）", () => {
      const csv = toTransactionsCsv([row({ memo: "\r=cmd" })]);
      expect(csv).toContain('"\'\r=cmd"');
    });

    it("カテゴリ名の数式インジェクションも無害化する", () => {
      const csv = toTransactionsCsv([row({ categoryName: "=HYPERLINK(1)" })]);
      expect(dataLines(csv)[0].split(",")[2]).toBe("'=HYPERLINK(1)");
    });

    it("登録者名の数式インジェクションも無害化する", () => {
      const csv = toTransactionsCsv([row({ memberName: "=1+1" })]);
      expect(dataLines(csv)[0].split(",")[5]).toBe("'=1+1");
    });

    it("無害化した値がカンマを含む場合はクオートも併用する", () => {
      const csv = toTransactionsCsv([row({ memo: "=1,2" })]);
      expect(dataLines(csv)[0]).toContain('"\'=1,2"');
    });

    it("先頭が安全な値には ' を付与しない", () => {
      const csv = toTransactionsCsv([row({ memo: "1=2" })]);
      expect(dataLines(csv)[0].split(",")[4]).toBe("1=2");
    });
  });
});
