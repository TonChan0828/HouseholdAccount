// `supabase migration list --linked` の出力を標準入力から読み、
// リポジトリと本番DBのマイグレーション適用状況のずれを検知する。
// main への push で Vercel は自動デプロイされるがマイグレーションは手動適用のため、
// 適用漏れのまま新コードが本番に出ると (dashboard) 全体がエラーになる。

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ROW = /^\s*(\d{14})?\s*\|\s*(\d{14})?\s*\|/;

/**
 * @param {string} output
 * @returns {{ local: string | null; remote: string | null }[]}
 */
export function parseMigrationList(output) {
  return output.split("\n").flatMap((line) => {
    const match = ROW.exec(line);
    if (!match || (!match[1] && !match[2])) return [];
    return [{ local: match[1] ?? null, remote: match[2] ?? null }];
  });
}

/**
 * @param {{ local: string | null; remote: string | null }[]} rows
 * @returns {{ pending: string[]; remoteOnly: string[] }}
 */
export function findMigrationDrift(rows) {
  if (rows.length === 0) {
    throw new Error("No migrations found in `supabase migration list` output");
  }
  return {
    pending: rows.flatMap((row) => (row.local && !row.remote ? [row.local] : [])),
    remoteOnly: rows.flatMap((row) => (row.remote && !row.local ? [row.remote] : [])),
  };
}

function main() {
  const { pending, remoteOnly } = findMigrationDrift(
    parseMigrationList(readFileSync(0, "utf8")),
  );
  if (pending.length === 0 && remoteOnly.length === 0) {
    console.log("All local migrations are applied to the remote database.");
    return;
  }
  for (const version of pending) {
    console.log(`::error title=Migration not applied::${version} is not applied to the remote database. Run \`supabase db push --linked\`.`);
  }
  for (const version of remoteOnly) {
    console.log(`::error title=Unknown remote migration::${version} is applied remotely but missing from supabase/migrations.`);
  }
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
