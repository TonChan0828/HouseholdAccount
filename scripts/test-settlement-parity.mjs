// Compare the actual TypeScript calculation with the migrated database function.
// Only an explicit local Docker container is used. Fixtures are rolled back.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";

function loadTypeScript(path, requireModule) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: requireModule });
  return exports;
}
const attribution = loadTypeScript("lib/transactions/attribution.ts");
const { buildSettlement } = loadTypeScript("lib/settlement.ts", (name) => {
  assert.equal(name, "@/lib/transactions/attribution");
  return attribution;
});
const project = readFileSync("supabase/config.toml", "utf8").match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
const container = process.argv[2] ?? `supabase_db_${project}`;
assert.match(container, /^supabase_db_[a-zA-Z0-9_-]+$/);
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const uid = (i) => `00000000-0000-0000-0000-${String(800 + i).padStart(12, "0")}`;
const sql = ["begin;"];
for (let i = 1; i <= 7; i++) sql.push(`insert into auth.users (id,email) values (${quote(uid(i))},${quote(`parity-${i}@example.test`)});`);
const cases = [[3000, 1000], [100, 0, 0], [1, 0, 0], [7, 11, 3, 17], [81, 4, 12, 0, 36], [2147483647, 1, 0, 9, 3, 14]];
let seed = 7654321;
for (let j = 0; j < 40; j++) {
  const n = 2 + j % 5;
  cases.push(Array.from({ length: n }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % 100_000;
  }));
}
const expected = [];
for (const [index, amounts] of cases.entries()) {
  const household = `86000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`;
  const members = amounts.map((_, i) => ({ user_id: uid(i + 1), display_name: `Member ${i + 1}` }));
  sql.push(`insert into public.households(id,name,created_by,period_start_day) values (${quote(household)},'Parity',${quote(uid(1))},25);`);
  for (let i = 0; i < members.length; i++) {
    if (i > 0) sql.push(`insert into public.household_members(household_id,user_id,role) values (${quote(household)},${quote(uid(i + 1))},'member');`);
    sql.push(`update public.household_members set joined_at='2026-01-01',display_name=${quote(members[i].display_name)} where household_id=${quote(household)} and user_id=${quote(uid(i + 1))};`);
  }
  const transactions = [];
  for (let i = 0; i < amounts.length; i++) {
    if (!amounts[i]) continue;
    const proxy = i > 0 && index % 2 === 0;
    const tx = { amount: amounts[i], created_by: proxy ? uid(1) : uid(i + 1), on_behalf_of: proxy ? uid(i + 1) : null, type: "expense", is_shared: true };
    transactions.push(tx);
    sql.push(`insert into public.transactions(household_id,created_by,on_behalf_of,amount,type,date,is_shared) values (${quote(household)},${quote(tx.created_by)},${tx.on_behalf_of ? quote(tx.on_behalf_of) : "null"},${tx.amount},'expense','2026-11-02',true);`);
  }
  const excluded = [
    { created_by: uid(7), amount: 777, type: "expense", is_shared: true },
    { created_by: uid(1), amount: 999, type: "income", is_shared: true },
    { created_by: uid(1), amount: 888, type: "expense", is_shared: false },
  ];
  transactions.push(...excluded);
  for (const tx of excluded) sql.push(`insert into public.transactions(household_id,created_by,amount,type,date,is_shared) values (${quote(household)},${quote(tx.created_by)},${tx.amount},${quote(tx.type)},'2026-11-02',${tx.is_shared});`);
  expected.push(JSON.parse(JSON.stringify(buildSettlement(transactions, members))));
  sql.push(`set local "request.jwt.claim.sub" = ${quote(uid(1))}; set local role authenticated;`);
  sql.push(`do $$begin perform public.create_settlement(${quote(household)},'2026-11-24'); end;$$;`);
  sql.push(`select snapshot from public.settlements where household_id=${quote(household)}; reset role;`);
}
sql.push("rollback;");
const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
  input: sql.join("\n"), encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
});
assert.equal(result.status, 0, result.stderr || String(result.error));
const actual = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
assert.equal(actual.length, expected.length);
for (let i = 0; i < expected.length; i++) assert.deepEqual(actual[i], expected[i], `Settlement parity case ${i + 1}`);
console.log(`Settlement parity: ${cases.length} database snapshots match the TypeScript implementation.`);
