import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("複数のクラス名を結合する", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("条件付きクラスを除外する", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("競合する Tailwind クラスは後勝ちでマージする", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
