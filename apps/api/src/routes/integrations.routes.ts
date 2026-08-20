import { Router } from "express";
import { requireAuth } from "../middleware/auth";

export const integrationsRouter = Router();
integrationsRouter.use(requireAuth);

integrationsRouter.post("/jira/test", (_req, res) => {
  res.status(501).json({ error: "Jira integration is not implemented until Phase 2" });
});

integrationsRouter.post("/slack/test", (_req, res) => {
  res.status(501).json({ error: "Slack integration is not implemented until Phase 2" });
});
