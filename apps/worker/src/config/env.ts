import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";
dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
});

const envSchema = z.object({
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ENDPOINT_URL: z.string().optional(),
  SQS_QUEUE_URL: z.string().min(1, "SQS_QUEUE_URL must be set"),
  S3_ARTIFACTS_BUCKET: z.string().default("pentest-artifacts"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  WORKER_VISIBILITY_TIMEOUT_SEC: z.coerce.number().default(1800),
});

export const env = envSchema.parse(process.env);
