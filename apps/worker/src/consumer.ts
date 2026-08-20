import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message,
} from "@aws-sdk/client-sqs";
import { pentestRequestedMessageSchema } from "@pentest/shared";
import type { PentestEngine } from "@pentest/strix";
import { env } from "./config/env";
import { logger } from "./logger";
import { processPentestRequested } from "./pentest-processor";

const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
});

export async function pollOnce(engine: PentestEngine): Promise<number> {
  const response = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: env.SQS_QUEUE_URL,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 10,
      VisibilityTimeout: env.WORKER_VISIBILITY_TIMEOUT_SEC,
    })
  );

  const messages = response.Messages ?? [];
  for (const message of messages) {
    await handleMessage(message, engine);
  }
  return messages.length;
}

async function handleMessage(message: Message, engine: PentestEngine): Promise<void> {
  if (!message.Body || !message.ReceiptHandle) return;

  let parsed;
  try {
    parsed = pentestRequestedMessageSchema.parse(JSON.parse(message.Body));
  } catch (err) {
    // Malformed message — deleting it is correct, retrying can't fix a parse error.
    logger.error({ err, body: message.Body }, "Dropping unparseable SQS message");
    await deleteMessage(message.ReceiptHandle);
    return;
  }

  try {
    await processPentestRequested(parsed, engine);
    await deleteMessage(message.ReceiptHandle);
  } catch (err) {
    // Leave the message in the queue — it becomes visible again after the
    // visibility timeout and SQS redelivers it. processPentestRequested's
    // runId-based idempotency check makes that redelivery safe.
    logger.error({ err, runId: parsed.runId }, "Unhandled error processing message — leaving for retry");
  }
}

async function deleteMessage(receiptHandle: string): Promise<void> {
  await sqsClient.send(
    new DeleteMessageCommand({ QueueUrl: env.SQS_QUEUE_URL, ReceiptHandle: receiptHandle })
  );
}

export async function runConsumerLoop(engine: PentestEngine, signal: { stopped: boolean }): Promise<void> {
  while (!signal.stopped) {
    try {
      const received = await pollOnce(engine);
      if (received === 0) {
        await sleep(env.WORKER_POLL_INTERVAL_MS);
      }
    } catch (err) {
      logger.error({ err }, "Poll loop error — backing off");
      await sleep(env.WORKER_POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
