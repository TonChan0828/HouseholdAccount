import { describe, expect, it } from "vitest";

import { findMigrationDrift, parseMigrationList } from "./check-migration-drift.mjs";

const header = `
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
`;

describe("parseMigrationList", () => {
  it("ローカルとリモートのバージョンを行ごとに読み取る", () => {
    const output = `${header}   20260928090000 | 20260928090000 | 2026-09-28 09:00:00
   20261005120000 |                | 2026-10-05 12:00:00
                  | 20261006000000 | 2026-10-06 00:00:00
`;

    expect(parseMigrationList(output)).toEqual([
      { local: "20260928090000", remote: "20260928090000" },
      { local: "20261005120000", remote: null },
      { local: null, remote: "20261006000000" },
    ]);
  });

  it("表以外の行（CLIの案内など）は無視する", () => {
    const output = `Initialising login role...
Connecting to remote database...
${header}   20260928090000 | 20260928090000 | 2026-09-28 09:00:00
A new version of Supabase CLI is available: v2.120.0
`;

    expect(parseMigrationList(output)).toEqual([
      { local: "20260928090000", remote: "20260928090000" },
    ]);
  });
});

describe("findMigrationDrift", () => {
  it("全て適用済みならずれなし", () => {
    expect(
      findMigrationDrift([{ local: "20260928090000", remote: "20260928090000" }]),
    ).toEqual({ pending: [], remoteOnly: [] });
  });

  it("リモート未適用とリモートのみの適用を分けて返す", () => {
    expect(
      findMigrationDrift([
        { local: "20260928090000", remote: "20260928090000" },
        { local: "20261005120000", remote: null },
        { local: null, remote: "20261006000000" },
      ]),
    ).toEqual({ pending: ["20261005120000"], remoteOnly: ["20261006000000"] });
  });

  it("行が1つもない場合は出力形式の変化やCLI失敗とみなして例外にする", () => {
    expect(() => findMigrationDrift([])).toThrow(/no migrations/i);
  });
});
