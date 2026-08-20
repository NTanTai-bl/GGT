import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./config/env";

const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  forcePathStyle: Boolean(env.AWS_ENDPOINT_URL), // required for LocalStack
});

export interface RunArtifacts {
  projectId: string;
  runId: string;
  stdout: string;
  stderr: string;
  rawFindings: unknown[];
  metadata: Record<string, unknown>;
}

/** Never write secrets (LLM/Jira/Slack keys) into these files — they may be shared for audit. */
export async function storeRunArtifacts(artifacts: RunArtifacts): Promise<void> {
  const prefix = `pentests/${artifacts.projectId}/${artifacts.runId}`;
  await Promise.all([
    putObject(`${prefix}/stdout.log`, artifacts.stdout),
    putObject(`${prefix}/stderr.log`, artifacts.stderr),
    putObject(`${prefix}/raw-strix-output.json`, JSON.stringify(artifacts.rawFindings, null, 2)),
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
