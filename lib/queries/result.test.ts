import { describe, expect, it } from "vitest";

import { DataAccessError } from "./errors";
import { throwIfError, unwrapData } from "./result";

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

describe("throwIfError", () => {
  it("成功時は何もしない", () => {
    expect(() => throwIfError({ error: null }, "save")).not.toThrow();
  });

  it("失敗時は操作名付きDataAccessErrorを投げる", () => {
    expect(() =>
      throwIfError({ error: { message: "detail" } }, "saveBudget"),
    ).toThrow(DataAccessError);
  });
});
