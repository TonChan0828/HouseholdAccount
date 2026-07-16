import { describe, expect, it } from "vitest";

import { toTokyoISODate } from "./date";

describe("toTokyoISODate", () => {
  it("UTCでは前日でも東京の日付を返す", () => {
    expect(toTokyoISODate(new Date("2026-07-15T15:15:00Z"))).toBe("2026-07-16");
  });

  it("東京の午前0時より前は前日を返す", () => {
    expect(toTokyoISODate(new Date("2026-07-15T14:59:59Z"))).toBe("2026-07-15");
  });
});
