import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GIT_BRANCH_PATTERN, GIT_COMMIT_SHA_PATTERN, isGitHubRepositoryUrl } from "@pentest/shared";

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 10 * 60 * 1000;

export interface GitRef {
  branch?: string | null;
  commitSha?: string | null;
}

export function hasGitRef(ref: GitRef): boolean {
  return Boolean(ref.branch?.trim() || ref.commitSha?.trim());
}

/**
 * Strix 1.6.1 has no option to pick a branch or commit — given a repository
 * URL it always clones the default branch. When a SOURCE target pins a branch
 * and/or commit, the worker clones that exact revision itself and hands Strix
 * the local directory instead.
 *
 * Every value reaches git as its own argv entry (no shell). Branch and SHA are
 * validated again here because rows created before schema validation existed
 * are not trusted.
 */
export async function cloneGitHubSource(repositoryUrl: string, destDir: string, ref: GitRef): Promise<string> {
  if (!isGitHubRepositoryUrl(repositoryUrl)) {
    throw new Error("Only https://github.com/owner/repository URLs can be cloned");
  }
  const branch = ref.branch?.trim() || undefined;
  const commitSha = ref.commitSha?.trim() || undefined;
  if (branch && !GIT_BRANCH_PATTERN.test(branch)) throw new Error("Target branch is not a valid git branch name");
  if (commitSha && !GIT_COMMIT_SHA_PATTERN.test(commitSha)) throw new Error("Target commitSha is not a valid hex SHA");

  // Blobless clone: full history (so any commit on the branch can be checked
  // out) without downloading every historical file version.
  const cloneArgs = ["clone", "--filter=blob:none", "--no-tags"];
  if (branch) cloneArgs.push(`--branch=${branch}`, "--single-branch");
  cloneArgs.push("--", repositoryUrl, destDir);

  await runGit(cloneArgs);
  if (commitSha) {
    await runGit(["-C", destDir, "-c", "advice.detachedHead=false", "checkout", "--detach", commitSha]);
  }
  return destDir;
}

async function runGit(args: string[]): Promise<void> {
  try {
    await execFileAsync("git", args, {
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      // Never block on an interactive credential prompt for a private repo.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr?.trim();
    throw new Error(`git ${args[0] === "-C" ? args[4] ?? "command" : args[0]} failed: ${(stderr || String(err)).slice(-500)}`);
  }
}
