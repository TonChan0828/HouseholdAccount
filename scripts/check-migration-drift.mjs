import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const VERSION = /^\d{14}$/;

/** @param {string} projectRef @param {string} token @param {typeof fetch} request */
export async function fetchMigrationVersions(projectRef, token, request = fetch) {
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF must be a valid project ref.");
  }
  if (!token.trim()) {
    throw new Error("SUPABASE_ACCESS_TOKEN is not set. Add a project-scoped Migrations (Read) token.");
  }

  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/migrations`;
  let response;
  try {
    response = await request(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Could not reach the Supabase migration history API.");
  }
  if (!response.ok) {
    throw new Error(`Could not read Supabase migration history: HTTP ${response.status}`);
  }

  let history;
  try {
    history = await response.json();
  } catch {
    throw new Error("Invalid migration history response from Supabase.");
  }
  if (!Array.isArray(history) || history.some((entry) =>
    typeof entry?.version !== "string" || !VERSION.test(entry.version))) {
    throw new Error("Invalid migration history response from Supabase.");
  }
  const versions = history.map(({ version }) => version);
  if (new Set(versions).size !== versions.length) {
    throw new Error("Invalid migration history response from Supabase.");
  }
  return versions;
}

/** @param {string[]} localVersions @param {string[]} remoteVersions */
export function findMigrationDrift(localVersions, remoteVersions) {
  if (!localVersions.length) {
    throw new Error("No local migrations found.");
  }
  const local = new Set(localVersions);
  const remote = new Set(remoteVersions);
  return {
    pending: localVersions.filter((version) => !remote.has(version)).sort(),
    remoteOnly: remoteVersions.filter((version) => !local.has(version)).sort(),
  };
}

function localMigrationVersions() {
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const versions = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map(({ name }) => {
      const version = /^(\d{14})_.+\.sql$/.exec(name)?.[1];
      if (!version) throw new Error("Invalid local migration filename.");
      return version;
    });
  if (new Set(versions).size !== versions.length) {
    throw new Error("Duplicate local migration version.");
  }
  return versions;
}

async function main() {
  const local = localMigrationVersions();
  const remote = await fetchMigrationVersions(
    process.env.SUPABASE_PROJECT_REF ?? "",
    process.env.SUPABASE_ACCESS_TOKEN ?? "",
  );
  const { pending, remoteOnly } = findMigrationDrift(local, remote);
  if (!pending.length && !remoteOnly.length) {
    console.log("All local migrations are applied to the remote database.");
    return;
  }
  for (const version of pending) {
    console.log(`::error title=Migration not applied::${version} is not applied to the remote database.`);
  }
  for (const version of remoteOnly) {
    console.log(`::error title=Unknown remote migration::${version} is applied remotely but missing from supabase/migrations.`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not compare migration histories.";
    console.error(`::error title=Migration history check failed::${message}`);
    process.exitCode = 1;
  }
}
