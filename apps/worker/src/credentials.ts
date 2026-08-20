import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { env } from "./config/env";

const secretsClient = new SecretsManagerClient({ region: env.AWS_REGION, endpoint: env.AWS_ENDPOINT_URL });

/**
 * Retrieves an AUTHENTICATED-scan credential immediately before the run and
 * writes it to a restricted file inside the run's own workspace — never
 * logged, never returned to the frontend, never stored in RDS beyond the
 * ARN. Caller MUST call deleteCredentialFile() after the run, success or not.
 */
export async function fetchAndStageCredential(secretArn: string, workspaceDir: string): Promise<string> {
  const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const value = response.SecretString;
  if (!value) {
    throw new Error("Secret has no SecretString value");
  }

  const filePath = path.join(workspaceDir, "credential.json");
  await writeFile(filePath, value, { mode: 0o600 });
  return filePath;
}

export async function deleteCredentialFile(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
}
