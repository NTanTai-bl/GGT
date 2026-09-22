import { createSequelize, initModels } from "@pentest/database";
import { loadLlmConfigFromEnv, StrixPentestEngine } from "@pentest/strix";
import { logger } from "./logger";
import { runConsumerLoop } from "./consumer";

// eslint-disable-next-line no-control-regex -- \x1B is the ANSI escape byte itself, intentional
const ANSI_ESCAPE_PATTERN = new RegExp("\\x1B\\[[0-?]*[ -/]*[@-~]", "g");
const MAX_LIVE_LOG_CHARS = 16_000;

function sanitizeStrixOutput(chunk: string): string {
  return chunk
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED_AWS_ACCESS_KEY]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_API_KEY]")
    .slice(0, MAX_LIVE_LOG_CHARS)
    .trimEnd();
}

async function main(): Promise<void> {
  const sequelize = createSequelize();
  initModels(sequelize);
  await sequelize.authenticate();
  logger.info("Database connection established");

  const llmConfig = loadLlmConfigFromEnv();
  logger.info({ strixLlm: llmConfig.strixLlm }, "Worker starting with LLM provider");

  const streamStrixLogs = process.env.STRIX_STREAM_LOGS === "true";
  logger.info({ streamStrixLogs }, "Strix live output configuration loaded");

  const engine = new StrixPentestEngine(llmConfig, {
    onStart: (event) => logger.info(event, "Strix process spawned"),
    onOutput: (event) => {
      if (!streamStrixLogs) return;
      const output = sanitizeStrixOutput(event.chunk);
      if (!output) return;
      const fields = { runId: event.runId, strixStream: event.stream, output };
      if (event.stream === "stderr") logger.warn(fields, "Strix live output");
      else logger.info(fields, "Strix live output");
    },
    onFinish: (event) => logger.info(event, "Strix process exited"),
  });
  const signal = { stopped: false };

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, finishing current poll cycle before exit");
    signal.stopped = true;
  });
  process.on("SIGINT", () => {
    signal.stopped = true;
  });

  await runConsumerLoop(engine, signal);
}

main().catch((err) => {
  logger.error({ err }, "Worker crashed");
  process.exit(1);
});
