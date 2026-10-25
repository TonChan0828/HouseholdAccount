import { expect, it } from "vitest";
import { safeLogLocation } from "./log-location";

it.each([
  "/invite/secret?key=secret#secret",
  "https://example.com/invite/secret?key=secret",
  "/%69nvite/secret",
  "/invite%2fsecret/extra",
])("招待トークンを記録しない: %s", (value) => {
  expect(safeLogLocation(value)).not.toContain("secret");
  expect(safeLogLocation(value)).toContain("/invite/[token]");
});
it("一般のURLは認証情報・クエリ・フラグメントを取り除く", () => {
  expect(safeLogLocation("https://user:password@example.com/dashboard?q=secret#secret"))
    .toBe("https://example.com/dashboard");
  expect(safeLogLocation("data:text/plain,secret")).not.toContain("secret");
});
