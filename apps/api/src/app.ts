import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { projectsRouter } from "./routes/projects.routes";
import { pentestsRouter } from "./routes/pentests.routes";
import { findingsRouter } from "./routes/findings.routes";
import { integrationsRouter } from "./routes/integrations.routes";
import { apiRateLimiter } from "./middleware/rateLimit";
import { auditLog } from "./middleware/auditLog";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(apiRateLimiter);
  app.use(auditLog);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/pentests", pentestsRouter);
  app.use("/api/findings", findingsRouter);
  app.use("/api/integrations", integrationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
