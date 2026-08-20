import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./config/env";

const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  forcePathStyle: Boolean(env.AWS_ENDPOINT_URL), // required for LocalStack
});

export interface RunArtifacts {
  runId: string;
  stdout: string;
  stderr: string;
  rawFindings: unknown[];
  metadata: Record<string, unknown>;
}

/**
 * Layout matches spec §20: s3://<bucket>/<run-id>/{...}. Never write
 * secrets (LLM key, staged test credentials) into these files — they're
 * kept for audit and may be shared with the requester.
 *
 * `run.json` and `report.md` from the spec's example layout are NOT
 * written here — nothing in this codebase generates distinct content for
 * them yet (a rendered summary report is a Phase 2 item); writing empty
 * placeholders would be worse than omitting them.
 */
export async function storeRunArtifacts(artifacts: RunArtifacts): Promise<void> {
  const prefix = artifacts.runId;
  await Promise.all([
    putObject(`${prefix}/stdout.log`, artifacts.stdout),
    putObject(`${prefix}/stderr.log`, artifacts.stderr),
    putObject(`${prefix}/vulnerabilities.json`, JSON.stringify(artifacts.rawFindings, null, 2)),
    putObject(`${prefix}/metadata.json`, JSON.stringify(artifacts.metadata, null, 2)),
  ]);
}

async function putObject(key: string, body: string): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_ARTIFACTS_BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream",
    })
  );
}
