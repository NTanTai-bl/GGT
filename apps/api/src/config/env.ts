import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
});

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET must be set"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ENDPOINT_URL: z.string().optional(),
  SQS_QUEUE_URL: z.string().min(1, "SQS_QUEUE_URL must be set"),
  S3_ARTIFACTS_BUCKET: z.string().default("pentest-artifacts"),
});

/**
 * Parsed once at boot. Deliberately does NOT include LLM_API_KEY, JIRA_API_TOKEN
 * or SLACK_BOT_TOKEN — those are worker/adapter-only secrets and must never be
 * reachable from an API request handler.
 */
export const env = envSchema.parse(process.env);
export type Env = typeof env;
