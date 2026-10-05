import { describe, expect, it } from "vitest";
import { decodePageCursor, encodePageCursor } from "./page-cursor";

const row = { date: "2026-10-05", created_at: "2026-10-05T12:34:56.123456+00:00", id: "11111111-1111-4111-8111-111111111111" };
describe("page cursor", () => {
  it("境界のマイクロ秒を維持し、前後方向を復元する", () => {
    for (const direction of ["after", "before"] as const) {
      expect(decodePageCursor(encodePageCursor(row, direction))).toEqual({ ...row, direction });
    }
  });
  it("不正な入力やクエリ構文を挿入する値を拒否する", () => {
    for (const input of [undefined, "50", "a".repeat(513), "{}", Buffer.from("null").toString("base64url"), encodePageCursor({ ...row, id: "id),date.gt.0" }, "after"), encodePageCursor({ ...row, created_at: "invalid" }, "after"), encodePageCursor({ ...row, date: "2026-02-30" }, "after")]) {
      expect(decodePageCursor(input)).toBeNull();
    }
  });
});
