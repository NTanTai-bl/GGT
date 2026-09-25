import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as tar from "tar";
import { strixWorkspaceRootFromEnv } from "@pentest/strix";
import { env } from "./config/env";
import { logger } from "./logger";

const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  forcePathStyle: Boolean(env.AWS_ENDPOINT_URL), // required for LocalStack — see docs/known-limitations.md
});

/**
 * Creates <STRIX_WORKSPACE_ROOT>/<runId>/ — every source download and
 * credential file for this run lives under this one directory, which is
 * scoped strictly to a server-generated runId (spec §28: never an
 * arbitrary path from frontend input).
 */
export async function createWorkspace(runId: string): Promise<string> {
  const dir = path.join(strixWorkspaceRootFromEnv(), runId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function deleteWorkspace(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (err) {
    // Best-effort cleanup — a leftover workspace is a disk-space problem,
    // not a reason to fail a scan that already completed.
    logger.warn({ err, dir }, "Failed to delete workspace after run");
  }
}

/**
 * Per-run TMPDIR for the Strix process. Strix clones GitHub targets into
 * `$TMPDIR/strix_repos/<run-name>/<repo>` and never deletes them, so without
 * this every scanned repository stayed on disk forever. The root must be a
 * path the host Docker daemon also sees at the same location (Strix
 * bind-mounts the clone into its sandbox), e.g. `${STRIX_DOCKER_SHARED_DIR}/runs`.
 * Returns null when GGT_STRIX_TMP_ROOT is not configured.
 */
export async function createStrixTempDir(runId: string): Promise<string | null> {
  const root = process.env.GGT_STRIX_TMP_ROOT?.trim();
  if (!root) return null;
  const dir = path.join(root, runId);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Repository checkouts Strix made under `<strixTmpDir>/strix_repos/<run-name>/<repo>`. */
export async function findStrixClones(strixTmpDir: string): Promise<string[]> {
  const reposRoot = path.join(strixTmpDir, "strix_repos");
  const clones: string[] = [];
  try {
    for (const runEntry of await readdir(reposRoot, { withFileTypes: true })) {
      if (!runEntry.isDirectory()) continue;
      const runDir = path.join(reposRoot, runEntry.name);
      for (const repoEntry of await readdir(runDir, { withFileTypes: true })) {
        if (repoEntry.isDirectory()) clones.push(path.join(runDir, repoEntry.name));
      }
    }
  } catch {
    // No GitHub target in this run, or Strix failed before cloning.
  }
  return clones;
}

/**
 * Downloads and extracts a `s3://bucket/key.tar.gz` source snapshot into
 * <workspaceDir>/source, returning that path for use as a SOURCE target.
 */
export async function downloadSource(workspaceDir: string, sourceUri: string): Promise<string> {
  const { bucket, key } = parseS3Uri(sourceUri);
  const sourceDir = path.join(workspaceDir, "source");
  await mkdir(sourceDir, { recursive: true });

  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = response.Body;
  if (!body || !("pipe" in body)) {
    throw new Error(`S3 object ${sourceUri} did not return a readable stream`);
  }

  await pipeline(body as NodeJS.ReadableStream, tar.x({ cwd: sourceDir }));
  return sourceDir;
}

function parseS3Uri(uri: string): { bucket: string; key: string } {
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid S3 source URI: ${uri}`);
  }
  return { bucket: match[1], key: match[2] };
}
