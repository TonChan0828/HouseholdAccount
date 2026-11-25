import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

const repository = "TonChan0828/HouseholdAccount";
const projectRef = "bkljkdkldaiemwpnjuks";
const workflows = ["ci.yml", "database.yml", "e2e.yml"];
const commitPattern = /^[a-f0-9]{40}$/;

/** Called only after the exact main commit's push checks have succeeded. */
export function releaseCommit({
  assertLatest,
  checkBefore,
  apply,
  checkAfter,
  deploy,
  smoke,
  promote,
  verifyLive,
}) {
  assertLatest();
  checkBefore();
  apply();
  checkAfter();
  const candidate = deploy();
  smoke(candidate);
  assertLatest();
  promote(candidate);
  verifyLive(candidate);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing release configuration: ${name}.`);
  return value;
}

function readOptional(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function main() {
  const preflightOnly = process.argv[2] === "--check";
  const repo = required("RELEASE_REPO");
  const stateDir = required("RELEASE_STATE_DIR");
  if (!isAbsolute(repo) || !isAbsolute(stateDir)) {
    throw new Error("RELEASE_REPO and RELEASE_STATE_DIR must be absolute paths.");
  }
  const productionUrl = required("PRODUCTION_URL");
  if (!/^https:\/\/[a-z0-9.-]+$/.test(productionUrl)) {
    throw new Error("PRODUCTION_URL must be an HTTPS origin.");
  }
  const ghToken = required("RELEASE_GITHUB_TOKEN");
  const supabaseToken = required("SUPABASE_ACCESS_TOKEN");
  const dbPassword = required("SUPABASE_DB_PASSWORD");
  const vercelToken = required("VERCEL_TOKEN");
  const vercelScope = required("VERCEL_SCOPE");
  const vercelOrgId = required("VERCEL_ORG_ID");
  const vercelProjectId = required("VERCEL_PROJECT_ID");

  // Only the corresponding CLI receives each credential.
  const env = { ...process.env };
  for (const key of [
    "RELEASE_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN",
    "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "VERCEL_TOKEN",
  ]) delete env[key];
  const ghEnv = { GH_TOKEN: ghToken };
  const dbEnv = { SUPABASE_ACCESS_TOKEN: supabaseToken, SUPABASE_DB_PASSWORD: dbPassword };
  const vercelEnv = { VERCEL_ORG_ID: vercelOrgId, VERCEL_PROJECT_ID: vercelProjectId };

  function run(file, args, cwd = repo, extraEnv = {}) {
    try {
      return execFileSync(file, args, {
        cwd,
        env: { ...env, ...extraEnv },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
        timeout: 30 * 60_000,
      }).trim();
    } catch {
      // Do not surface execFileSync's command string, which can contain CLI credentials.
      throw new Error(`${file} failed during the production release.`);
    }
  }

  const mainSha = () => run("gh", ["api", `repos/${repository}/git/ref/heads/main`, "--jq", ".object.sha"], repo, ghEnv);
  const verified = (commit) => workflows.every((workflow) => {
    const response = run("gh", ["run", "list", "--repo", repository, "--workflow", workflow,
      "--branch", "main", "--commit", commit, "--event", "push", "--limit", "1",
      "--json", "conclusion,status"], repo, ghEnv);
    const latest = JSON.parse(response)[0];
    if (latest?.status === "completed" && latest.conclusion !== "success") {
      throw new Error(`${workflow} concluded with ${latest.conclusion} for ${commit}.`);
    }
    return latest?.conclusion === "success";
  });

  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const lock = join(stateDir, "release.lock");
  let fd;
  try {
    fd = openSync(lock, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      console.log("Another release owns the lock.");
      return;
    }
    throw error;
  }

  const published = join(stateDir, "published-commit");
  const workspace = mkdtempSync(join(tmpdir(), "household-release-"));
  const checkout = join(workspace, "checkout");
  let attached = false;

  try {
    writeFileSync(fd, `${process.pid}\n`);
    const commit = mainSha();
    if (!commitPattern.test(commit)) throw new Error("GitHub did not return a valid main commit.");
    if (!verified(commit)) {
      console.log(`Waiting for successful CI, Database and E2E on ${commit}.`);
      return;
    }
    const origin = run("git", ["remote", "get-url", "origin"]);
    if (!new Set([
      `https://github.com/${repository}.git`,
      `https://github.com/${repository}`,
      `git@github.com:${repository}.git`,
    ]).has(origin)) throw new Error("Release clone must point to the HouseholdAccount repository.");
    run("git", ["fetch", "--no-tags", "origin", "refs/heads/main"]);
    if (run("git", ["rev-parse", "FETCH_HEAD"]) !== commit) {
      console.log("Main changed while fetching. This release will be retried.");
      return;
    }
    run("git", ["worktree", "add", "--detach", checkout, commit]);
    attached = true;

    const drift = (options = []) => run(process.execPath, [
      "scripts/check-migration-drift.mjs", ...options,
    ], checkout, { SUPABASE_PROJECT_REF: projectRef, SUPABASE_ACCESS_TOKEN: supabaseToken });
    if (!preflightOnly && readOptional(published) === commit) {
      console.log(drift());
      return;
    }

    const vercel = (args) => run("vercel", [
      ...args, "--scope", vercelScope, "--token", vercelToken,
    ], checkout, vercelEnv);
    const assertLatest = () => {
      if (mainSha() !== commit) throw new Error("A newer main commit superseded this release.");
    };
    const checkBefore = () => {
      console.log(drift(["--allow-pending-tail"]));
      vercel(["project", "inspect", vercelProjectId]);
      run("supabase", ["link", "--project-ref", projectRef], checkout, dbEnv);
      run("supabase", ["db", "push", "--linked", "--dry-run"], checkout, dbEnv);
    };
    if (preflightOnly) {
      assertLatest();
      checkBefore();
      console.log(`Production preflight succeeded for ${commit}.`);
      return;
    }
    releaseCommit({
      assertLatest,
      checkBefore,
      apply() {
        assertLatest();
        run("supabase", ["db", "push", "--linked", "--yes"], checkout, dbEnv);
      },
      checkAfter() {
        console.log(drift());
      },
      deploy() {
        rmSync(join(checkout, "supabase", ".temp"), { recursive: true, force: true });
        const candidate = vercel(["deploy", "--prod", "--skip-domain", "--archive=tgz", "--yes"]);
        if (!/^https:\/\/[a-z0-9.-]+\.vercel\.app$/.test(candidate)) {
          throw new Error("Vercel did not return a valid candidate URL.");
        }
        return candidate;
      },
      smoke(candidate) {
        run("vercel", ["curl", "/login", "--deployment", candidate, "--scope", vercelScope,
          "--token", vercelToken, "--", "--fail", "--silent", "--show-error",
          "--max-time", "30", "--output", "/dev/null"], checkout, vercelEnv);
      },
      promote(candidate) {
        vercel(["promote", candidate, "--yes"]);
      },
      verifyLive(candidate) {
        const expected = JSON.parse(vercel(["inspect", candidate, "--json"])).id;
        const live = JSON.parse(vercel(["inspect", productionUrl, "--json"])).id;
        if (typeof expected !== "string" || live !== expected) {
          throw new Error("The production domain does not point to the verified candidate.");
        }
        run("curl", ["--fail", "--silent", "--show-error", "--max-time", "30",
          "--output", "/dev/null", `${productionUrl}/login`], checkout);
      },
    });
    const marker = join(stateDir, "published-commit.next");
    writeFileSync(marker, commit + "\n", { mode: 0o600 });
    renameSync(marker, published);
    console.log(`Published ${commit}.`);
  } finally {
    try {
      if (attached) run("git", ["worktree", "remove", "--force", checkout]);
      rmSync(workspace, { recursive: true, force: true });
    } finally {
      closeSync(fd);
      rmSync(lock, { force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Production release failed.");
    process.exitCode = 1;
  }
}
