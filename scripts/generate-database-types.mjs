import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const workingDirectory = process.argv[2];
const args = ["gen", "types", "typescript", "--local", "--schema", "public"];
if (workingDirectory) args.push("--workdir", workingDirectory);

const generated = execFileSync("supabase", args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
if (!generated.startsWith("export type Json =") || !generated.includes("export type Database =")) {
  throw new Error("The Supabase CLI did not return TypeScript database types.");
}

// Postgres function arguments can be null. The generator omits nullability;
// the import function explicitly uses a null member to mean the current user.
const importMember = /(confirm_transaction_import_v2: \{\s+Args: \{\s+_household_id: string\s+_member_id: string)(?=\n)/;
if (!importMember.test(generated)) {
  throw new Error("Review the generated import member argument and its null handling.");
}
const schema = generated.replace(importMember, "$1 | null");
const aliases = `
// 既存の呼び出し元が使用する列挙型の別名。
export type MemberRole = Database["public"]["Enums"]["member_role"]
export type TransactionType = Database["public"]["Enums"]["transaction_type"]
export type CategoryType = Database["public"]["Enums"]["category_type"]
`;

writeFileSync(
  fileURLToPath(new URL("../types/database.ts", import.meta.url)),
  "// Generated from the local database by npm run db:types.\n\n" + schema.trimEnd() + "\n" + aliases,
);
