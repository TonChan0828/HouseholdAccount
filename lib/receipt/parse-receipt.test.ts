import { describe, expect, it } from "vitest";

import { parseReceipt } from "./parse-receipt";

// 多くのケースで日付の当年補完を決定的にするため固定の「今日」を渡す。
const TODAY = new Date(2026, 5, 26); // 2026-06-26

describe("parseReceipt - 金額", () => {
  it("合計キーワード行の金額を抽出する（カンマ・¥付き）", () => {
    const text = [
      "スーパーマーケット",
      "2024/01/15",
      "小計 1,200",
      "合計 ¥1,320",
      "お預り 2,000",
      "お釣り 680",
    ].join("\n");
    expect(parseReceipt(text, TODAY).amount).toBe(1320);
  });

  it("小計より合計を優先する", () => {
    const text = ["小計 800", "消費税 80", "合計 880"].join("\n");
    expect(parseReceipt(text, TODAY).amount).toBe(880);
  });

  it("お会計キーワードと円サフィックスを扱う", () => {
    const text = ["お会計 980円"].join("\n");
    expect(parseReceipt(text, TODAY).amount).toBe(980);
  });

  it("全角の数字・記号を正規化して抽出する", () => {
    const text = ["合計　￥２，８１０"].join("\n");
    expect(parseReceipt(text, TODAY).amount).toBe(2810);
  });

  it("キーワードが無ければ通貨らしいトークンの最大値をフォールバックにする", () => {
    const text = ["ありがとうございました", "¥500", "¥1,500"].join("\n");
    expect(parseReceipt(text, TODAY).amount).toBe(1500);
  });

  it("フォールバックでは電話番号などの非通貨トークンを無視する", () => {
    const text = ["TEL 0120-000-111", "合計なし", "¥1,200"].join("\n");
    expect(parseReceipt(text, TODAY).amount).toBe(1200);
  });

  it("金額が見つからなければ null", () => {
    const text = ["ありがとうございました", "またのご来店を"].join("\n");
    expect(parseReceipt(text, TODAY).amount).toBeNull();
  });

  it("範囲外の巨大な数値は採用しない", () => {
    const text = ["合計 123456789"].join("\n");
    expect(parseReceipt(text, TODAY).amount).toBeNull();
  });

  it("合計行に複数の数値があれば右端を金額とする", () => {
    const text = ["合計 3点 ¥1,200"].join("\n");
    expect(parseReceipt(text, TODAY).amount).toBe(1200);
  });
});

describe("parseReceipt - 日付", () => {
  it("YYYY/MM/DD を抽出する", () => {
    const text = ["2024/01/15", "合計 1,320"].join("\n");
    expect(parseReceipt(text, TODAY).date).toBe("2024-01-15");
  });

  it("YYYY年MM月DD日 を抽出する", () => {
    const text = ["2024年3月5日", "合計 2,810"].join("\n");
    expect(parseReceipt(text, TODAY).date).toBe("2024-03-05");
  });

  it("ハイフン区切りを抽出する", () => {
    const text = ["2023-12-31 19:45", "お会計 980円"].join("\n");
    expect(parseReceipt(text, TODAY).date).toBe("2023-12-31");
  });

  it("年が無い MM/DD は今日の年で補完する", () => {
    const text = ["01/05", "合計 600"].join("\n");
    expect(parseReceipt(text, TODAY).date).toBe("2026-01-05");
  });

  it("不正な月日は採用しない", () => {
    const text = ["2024/13/40", "合計 600"].join("\n");
    expect(parseReceipt(text, TODAY).date).toBeNull();
  });

  it("日付が見つからなければ null", () => {
    const text = ["合計 600"].join("\n");
    expect(parseReceipt(text, TODAY).date).toBeNull();
  });

  it("時刻（コロン区切り）を日付として誤認しない", () => {
    const text = ["レジ 15:08", "合計 600"].join("\n");
    expect(parseReceipt(text, TODAY).date).toBeNull();
  });
});

describe("parseReceipt - 入力ガード", () => {
  it("空文字なら両方 null", () => {
    expect(parseReceipt("", TODAY)).toEqual({ amount: null, date: null });
  });
});
