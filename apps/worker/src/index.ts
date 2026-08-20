import { createSequelize, initModels } from "@pentest/database";
import { loadLlmConfigFromEnv, StrixPentestEngine } from "@pentest/strix";
import { logger } from "./logger";
import { runConsumerLoop } from "./consumer";

async function main(): Promise<void> {
  const sequelize = createSequelize();
  initModels(sequelize);
  await sequelize.authenticate();
  logger.info("Database connection established");

  const llmConfig = loadLlmConfigFromEnv();
  logger.info({ strixLlm: llmConfig.strixLlm }, "Worker starting with LLM provider");

  const engine = new StrixPentestEngine(llmConfig);
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
