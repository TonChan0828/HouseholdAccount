import { describe, expect, it } from "vitest";

import {
  buildFilterQueryString,
  escapeLike,
  hasActiveFilter,
  parseTransactionFilter,
} from "./transaction-filter";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("parseTransactionFilter", () => {
  it("空のパラメータからは空のフィルタを返す", () => {
    expect(parseTransactionFilter({})).toStrictEqual({});
  });

  it("有効な type / category / member を取り込む", () => {
    expect(
      parseTransactionFilter({ type: "expense", category: UUID, member: UUID }),
    ).toEqual({ type: "expense", categoryId: UUID, createdBy: UUID });
  });

  it("不正な type は無視する", () => {
    expect(parseTransactionFilter({ type: "invalid" })).toEqual({});
  });

  it("UUID 形式でない category / member は無視する", () => {
    expect(
      parseTransactionFilter({ category: "abc", member: "1; DROP TABLE" }),
    ).toEqual({});
  });

  it("UUID の桁数が1文字でもずれると無視する", () => {
    expect(
      parseTransactionFilter({ category: UUID.slice(0, -1) }),
    ).toEqual({});
    expect(parseTransactionFilter({ category: `${UUID}x` })).toEqual({});
  });

  it("UUID の前後に余計な文字が付く場合は無視する（部分一致を許さない）", () => {
    expect(parseTransactionFilter({ category: `x${UUID}` })).toEqual({});
    expect(parseTransactionFilter({ category: `${UUID}x` })).toEqual({});
  });

  it("大文字の UUID も受理する", () => {
    const upper = UUID.toUpperCase();
    expect(parseTransactionFilter({ category: upper })).toEqual({
      categoryId: upper,
    });
  });

  it("q は前後の空白を除去し、空なら無視する", () => {
    expect(parseTransactionFilter({ q: "  コンビニ " })).toEqual({
      memoQuery: "コンビニ",
    });
    expect(parseTransactionFilter({ q: "   " })).toEqual({});
  });

  it("min / max は 0 以上の整数のみ取り込む", () => {
    expect(parseTransactionFilter({ min: "1000", max: "5000" })).toEqual({
      minAmount: 1000,
      maxAmount: 5000,
    });
    expect(parseTransactionFilter({ min: "-1" })).toEqual({});
    expect(parseTransactionFilter({ min: "1.5" })).toEqual({});
    expect(parseTransactionFilter({ max: "abc" })).toEqual({});
  });
});

describe("escapeLike", () => {
  it("% と _ と \\ をエスケープする", () => {
    expect(escapeLike("100%_off\\x")).toBe("100\\%\\_off\\\\x");
  });

  it("通常の文字列はそのまま返す", () => {
    expect(escapeLike("コンビニ")).toBe("コンビニ");
  });
});

describe("hasActiveFilter", () => {
  it("フィルタが空なら false", () => {
    expect(hasActiveFilter({})).toBe(false);
  });

  it("いずれかの条件があれば true", () => {
    expect(hasActiveFilter({ type: "income" })).toBe(true);
    expect(hasActiveFilter({ minAmount: 0 })).toBe(true);
  });

  it("値が明示的に undefined なプロパティだけなら false", () => {
    expect(hasActiveFilter({ type: undefined })).toBe(false);
  });
});

describe("buildFilterQueryString", () => {
  it("空のフィルタからは空文字を返す", () => {
    expect(buildFilterQueryString({})).toBe("");
  });

  it("有効な条件をクエリ文字列にする（URL エンコード込み）", () => {
    const qs = buildFilterQueryString({
      type: "expense",
      categoryId: UUID,
      memoQuery: "コンビニ",
      minAmount: 100,
    });
    const params = new URLSearchParams(qs);
    expect(params.get("type")).toBe("expense");
    expect(params.get("category")).toBe(UUID);
    expect(params.get("q")).toBe("コンビニ");
    expect(params.get("min")).toBe("100");
    expect(params.has("max")).toBe(false);
    expect(params.has("member")).toBe(false);
  });

  it("maxAmount 単体もクエリ文字列に含める", () => {
    const qs = buildFilterQueryString({ maxAmount: 500 });
    const params = new URLSearchParams(qs);
    expect(params.get("max")).toBe("500");
  });
});
