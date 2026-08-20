import { Router } from "express";
import { updateFindingSchema } from "@pentest/shared";
import { asyncHandler } from "./asyncHandler";
import { requireAuth } from "../middleware/auth";
import { updateFinding } from "../services/finding.service";

export const findingsRouter = Router();
findingsRouter.use(requireAuth);

findingsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateFindingSchema.parse(req.body);
    res.json(await updateFinding(req.params.id as string, input));
  })
);

findingsRouter.post("/:id/jira", (_req, res) => {
  res.status(501).json({ error: "Jira integration is not implemented until Phase 2" });
});
