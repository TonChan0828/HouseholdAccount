import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { assertMigrationPrefix, fetchMigrationVersions, findMigrationDrift, localMigrationVersions } from "./check-migration-drift.mjs";

const project = "bkljkdkldaiemwpnjuks";
const localVersion = "20260928090000";
const pendingVersion = "20261005120000";
const remoteVersion = "20261006000000";

describe("assertMigrationPrefix", () => {
  const a = "20260618212503";
  const b = "20260618212518";
  const c = "20260618212528";

  it("照合結果の順序にかかわらず末尾に連続する未適用だけを許す", () => {
    expect(assertMigrationPrefix([c, b, a], [b, a])).toEqual([c]);
  });

  it("適用履歴の途中に欠落があれば停止する", () => {
    expect(() => assertMigrationPrefix([a, b, c], [a, c])).toThrow(/pending version before/);
  });

  it("未知の適用履歴があれば停止する", () => {
    expect(() => assertMigrationPrefix([a, b], [a, c])).toThrow(/Unknown remote migrations/);
  });
});

describe("findMigrationDrift", () => {
  it("一致時は差分なしになる", () => {
    expect(findMigrationDrift([localVersion], [localVersion])).toEqual({
      pending: [], remoteOnly: [],
    });
  });

  it("未適用と本番にだけある履歴を分ける", () => {
    expect(findMigrationDrift([localVersion, pendingVersion], [localVersion, remoteVersion]))
      .toEqual({ pending: [pendingVersion], remoteOnly: [remoteVersion] });
  });

  it("本番履歴が空でも未適用を検出する", () => {
    expect(findMigrationDrift([localVersion], [])).toEqual({ pending: [localVersion], remoteOnly: [] });
  });

  it("ローカルに履歴がなければ失敗する", () => {
    expect(() => findMigrationDrift([], [])).toThrow(/local migrations/i);
  });
});

it("リンクされたSQLファイルを黙って除外しない", () => {
  const directory = mkdtempSync(join(tmpdir(), "household-drift-test-"));
  try {
    const ordinaryFile = join(directory, `${localVersion}_ordinary.sql`);
    writeFileSync(ordinaryFile, "");
    expect(localMigrationVersions(directory)).toEqual([localVersion]);
    symlinkSync(ordinaryFile, join(directory, `${pendingVersion}_linked.sql`));
    expect(() => localMigrationVersions(directory)).toThrow(/not a regular file/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("fetchMigrationVersions", () => {
  it("本番プロジェクトの履歴だけを読み取り、リダイレクトを許可しない", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json([{ version: localVersion, name: "fiscal_year" }]),
    );
    await expect(fetchMigrationVersions(project, "test-only", request)).resolves.toEqual([localVersion]);
    expect(request).toHaveBeenCalledWith(
      `https://api.supabase.com/v1/projects/${project}/database/migrations`,
      expect.objectContaining({ headers: { Authorization: "Bearer test-only" }, redirect: "error" }),
    );
  });

  it("トークンが空の場合はネットワークに接続しない", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(fetchMigrationVersions(project, " ", request)).rejects.toThrow(/token is not set/i);
    expect(request).not.toHaveBeenCalled();
  });

  it("ネットワークエラーの詳細を表示しない", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("sensitive-detail"));
    await expect(fetchMigrationVersions(project, "test-only", request)).rejects.toThrow(
      /^Could not reach the Supabase migration history API\.$/,
    );
  });

  it("JSONとして解釈できない応答を拒否する", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("<html>unavailable</html>"));
    await expect(fetchMigrationVersions(project, "test-only", request)).rejects.toThrow(/invalid migration history/i);
  });

  it.each([401, 403, 429, 500])("HTTP %i をエラーにし本文を表示しない", async (status) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("sensitive-body", { status }));
    await expect(fetchMigrationVersions(project, "test-only", request)).rejects.toThrow(
      new RegExp(`HTTP ${status}$`),
    );
  });

  it.each([null, { version: localVersion }, [{ version: "bad" }], [
    { version: localVersion }, { version: localVersion },
  ]])("不正な履歴を拒否する: %j", async (data) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(data));
    await expect(fetchMigrationVersions(project, "test-only", request)).rejects.toThrow(/invalid migration history/i);
  });
});
