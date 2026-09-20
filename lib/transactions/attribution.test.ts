import { describe, expect, it } from "vitest";

import {
  attributedTo,
  attributionOrFilter,
  canEditTransaction,
  isProxyEntry,
  normalizeOnBehalfOf,
  proxyLabel,
} from "./attribution";

const TARO = "11111111-1111-4111-8111-111111111111";
const HANAKO = "22222222-2222-4222-8222-222222222222";
const JIRO = "33333333-3333-4333-8333-333333333333";

/** 太郎が花子の代理で入力した収支。 */
const proxy = { created_by: TARO, on_behalf_of: HANAKO };
/** 太郎が自分名義で入力した収支。 */
const own = { created_by: TARO, on_behalf_of: null };

describe("attributedTo", () => {
  it("名義人があれば名義人を返す", () => {
    expect(attributedTo(proxy)).toBe(HANAKO);
  });

  it("名義人が null なら入力者を返す", () => {
    expect(attributedTo(own)).toBe(TARO);
  });

  it("名義人の項目自体が無い行（デモモード等）でも入力者を返す", () => {
    expect(attributedTo({ created_by: TARO })).toBe(TARO);
  });

  it("名義人が入力者と同じでも入力者を返す", () => {
    expect(attributedTo({ created_by: TARO, on_behalf_of: TARO })).toBe(TARO);
  });
});

describe("isProxyEntry", () => {
  it("名義人が入力者と異なれば true", () => {
    expect(isProxyEntry(proxy)).toBe(true);
  });

  it("名義人が null なら false", () => {
    expect(isProxyEntry(own)).toBe(false);
  });

  it("名義人が入力者と同じなら false", () => {
    expect(isProxyEntry({ created_by: TARO, on_behalf_of: TARO })).toBe(false);
  });
});

describe("canEditTransaction", () => {
  it("入力者は編集できる", () => {
    expect(canEditTransaction(proxy, TARO)).toBe(true);
  });

  it("名義人も編集できる", () => {
    expect(canEditTransaction(proxy, HANAKO)).toBe(true);
  });

  it("入力者でも名義人でもなければ編集できない", () => {
    expect(canEditTransaction(proxy, JIRO)).toBe(false);
  });

  it("代理でない収支は入力者だけが編集できる", () => {
    expect(canEditTransaction(own, TARO)).toBe(true);
    expect(canEditTransaction(own, HANAKO)).toBe(false);
  });
});

describe("proxyLabel", () => {
  const names = new Map([
    [TARO, "太郎"],
    [HANAKO, "花子"],
  ]);

  it("代理入力なら「名義人（入力者が代理）」を返す", () => {
    expect(proxyLabel(proxy, names)).toBe("花子（太郎が代理）");
  });

  it("代理入力でなければ null を返す", () => {
    expect(proxyLabel(own, names)).toBeNull();
  });

  it("入力者の表示名が引けなければフォールバック名にする", () => {
    expect(proxyLabel({ created_by: JIRO, on_behalf_of: HANAKO }, names)).toBe(
      "花子（不明なユーザーが代理）",
    );
  });

  it("名義人の表示名が引けなければフォールバック名にする", () => {
    expect(proxyLabel({ created_by: TARO, on_behalf_of: JIRO }, names)).toBe(
      "不明なユーザー（太郎が代理）",
    );
  });
});

describe("normalizeOnBehalfOf", () => {
  it("未指定は null にする", () => {
    expect(normalizeOnBehalfOf(undefined, TARO)).toBeNull();
  });

  it("入力者と同じ人を指定したら null にする（代理ではないため）", () => {
    expect(normalizeOnBehalfOf(TARO, TARO)).toBeNull();
  });

  it("入力者と別の人を指定したらその id を返す", () => {
    expect(normalizeOnBehalfOf(HANAKO, TARO)).toBe(HANAKO);
  });

  it("比較対象は入力者であって操作者ではない", () => {
    // 太郎が入力し花子を名義人にした収支を、花子自身が編集して名義を据え置く場合。
    // 操作者（花子）と比べると名義が外れてしまうため、入力者（太郎）と比べる。
    expect(normalizeOnBehalfOf(HANAKO, TARO)).toBe(HANAKO);
  });
});

describe("attributionOrFilter", () => {
  it("名義人一致と「名義人なし かつ 入力者一致」の or 句を作る", () => {
    expect(attributionOrFilter(HANAKO)).toBe(
      `on_behalf_of.eq.${HANAKO},and(on_behalf_of.is.null,created_by.eq.${HANAKO})`,
    );
  });

  it("UUID でない値は例外にする（フィルタ文字列への注入を防ぐ）", () => {
    expect(() => attributionOrFilter("x,y")).toThrow(
      "attributionOrFilter: userId must be a UUID",
    );
    expect(() => attributionOrFilter("")).toThrow();
    // 前後に余計な文字が付いた値も弾く（部分一致で通すと式を書き換えられる）
    expect(() => attributionOrFilter(`${HANAKO})`)).toThrow();
    expect(() => attributionOrFilter(`or(${HANAKO}`)).toThrow();
  });
});
