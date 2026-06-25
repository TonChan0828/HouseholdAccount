import { describe, expect, it } from "vitest";

import { evaluateAmount, evaluateExpression } from "./amount-expression";

describe("evaluateExpression", () => {
  it("プレーンな数値をそのまま返す", () => {
    expect(evaluateExpression("1000")).toBe(1000);
  });

  it("加算・減算を計算する", () => {
    expect(evaluateExpression("1280+980+550")).toBe(2810);
    expect(evaluateExpression("1000-300")).toBe(700);
  });

  it("乗算・除算を計算する", () => {
    expect(evaluateExpression("200*3")).toBe(600);
    expect(evaluateExpression("3000/4")).toBe(750);
  });

  it("× ÷ 記号を演算子として受け付ける", () => {
    expect(evaluateExpression("200×3")).toBe(600);
    expect(evaluateExpression("3000÷4")).toBe(750);
  });

  it("演算子の優先順位を守る", () => {
    expect(evaluateExpression("1000+200*3")).toBe(1600);
  });

  it("括弧で優先順位を上書きする", () => {
    expect(evaluateExpression("(1000+200)*3")).toBe(3600);
  });

  it("単項マイナスを許可する", () => {
    expect(evaluateExpression("-500")).toBe(-500);
    expect(evaluateExpression("(-3)*2")).toBe(-6);
  });

  it("全角の数字・記号を正規化して計算する", () => {
    expect(evaluateExpression("１０００＋５００")).toBe(1500);
    expect(evaluateExpression("２００×３")).toBe(600);
  });

  it("空白を無視する", () => {
    expect(evaluateExpression(" 1000 + 500 ")).toBe(1500);
  });

  it("小数を含む計算もそのまま返す（丸めは呼び出し側）", () => {
    expect(evaluateExpression("1000/3")).toBeCloseTo(333.333, 2);
  });

  it("空文字は null", () => {
    expect(evaluateExpression("")).toBeNull();
    expect(evaluateExpression("   ")).toBeNull();
  });

  it("構文エラーは null", () => {
    expect(evaluateExpression("1000+")).toBeNull();
    expect(evaluateExpression("abc")).toBeNull();
    expect(evaluateExpression("1+*2")).toBeNull();
    expect(evaluateExpression("(1000+200")).toBeNull();
    expect(evaluateExpression("1000+200)")).toBeNull();
  });

  it("0除算は null", () => {
    expect(evaluateExpression("1000/0")).toBeNull();
  });
});

describe("evaluateAmount", () => {
  it("計算結果を四捨五入した整数を返す", () => {
    expect(evaluateAmount("1000/3")).toBe(333);
    expect(evaluateAmount("1000/8")).toBe(125);
    expect(evaluateAmount("100/8")).toBe(13); // 12.5 → 13
  });

  it("有効な整数式はそのまま整数を返す", () => {
    expect(evaluateAmount("1280+980+550")).toBe(2810);
  });

  it("無効な式は NaN を返す", () => {
    expect(Number.isNaN(evaluateAmount("1000+"))).toBe(true);
    expect(Number.isNaN(evaluateAmount("abc"))).toBe(true);
    expect(Number.isNaN(evaluateAmount(""))).toBe(true);
  });
});
