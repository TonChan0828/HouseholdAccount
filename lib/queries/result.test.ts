import { describe, expect, it } from "vitest";

import { DataAccessError } from "./errors";
import { unwrapData } from "./result";

describe("unwrapData", () => {
  it("成功時はdataを返す", () => {
    expect(unwrapData({ data: [1], error: null }, "load")).toEqual([1]);
  });

  it("失敗時は操作名付きDataAccessErrorを投げる", () => {
    expect(() =>
      unwrapData({ data: null, error: { message: "detail" } }, "loadBudgets"),
    ).toThrow(DataAccessError);
  });
});
