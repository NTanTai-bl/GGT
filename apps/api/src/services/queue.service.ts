import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { PentestRequestedMessage } from "@pentest/shared";
import { env } from "../config/env";

const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
});

export async function publishPentestRequested(message: PentestRequestedMessage): Promise<void> {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(message),
      // MessageGroupId is only needed for FIFO queues — the standard queue
      // used here relies on the worker's own idempotency-by-runId instead.
    })
  );
}
