import { createSequelize, initModels } from "@pentest/database";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

async function main(): Promise<void> {
  const sequelize = createSequelize();
  initModels(sequelize);
  await sequelize.authenticate();
  logger.info("Database connection established");

  const app = createApp();
  app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT }, "API listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Failed to start API");
  process.exit(1);
});
