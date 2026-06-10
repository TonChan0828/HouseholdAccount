import { describe, expect, it } from "vitest";

import { NAV_ITEMS, isNavActive } from "./nav-items";

describe("NAV_ITEMS", () => {
  it("主要5ページへのリンクを定義する", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      "/",
      "/transactions",
      "/analytics",
      "/members",
      "/categories",
    ]);
  });
});

describe("isNavActive", () => {
  it("ホーム（/）は完全一致のときのみアクティブ", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/transactions", "/")).toBe(false);
  });

  it("配下のパスでもアクティブになる", () => {
    expect(isNavActive("/transactions", "/transactions")).toBe(true);
    expect(isNavActive("/transactions/new", "/transactions")).toBe(true);
    expect(isNavActive("/categories/abc/edit", "/categories")).toBe(true);
  });

  it("前方一致しないパスは非アクティブ", () => {
    expect(isNavActive("/members", "/transactions")).toBe(false);
    expect(isNavActive("/transactions-archive", "/transactions")).toBe(false);
  });
});
