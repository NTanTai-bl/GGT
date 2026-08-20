import { mkdir, rm } from "node:fs/promises";
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
