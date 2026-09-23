import { Router } from "express";
import { updateFindingSchema } from "@pentest/shared";
import { asyncHandler } from "./asyncHandler";
import { requireAuth } from "../middleware/auth";
import { getFindingOrThrow, updateFinding } from "../services/finding.service";

export const findingsRouter = Router();
findingsRouter.use(requireAuth);

findingsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getFindingOrThrow(req.params.id as string, req.user!));
  })
);

findingsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateFindingSchema.parse(req.body);
    res.json(await updateFinding(req.params.id as string, input, req.user!));
  })
);
