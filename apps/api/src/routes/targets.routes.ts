import { Router } from "express";
import { updateTargetSchema } from "@pentest/shared";
import { asyncHandler } from "./asyncHandler";
import { requireAuth } from "../middleware/auth";
import { assertProjectAccess, requirePermission } from "../middleware/rbac";
import { deleteTarget, getTargetOrThrow, updateTarget } from "../services/target.service";
import { uuidParam } from "../middleware/validateParams";

export const targetsRouter = Router();
targetsRouter.use(requireAuth);
targetsRouter.param("id", uuidParam);
targetsRouter.use(requirePermission("TARGET_MANAGE"));

targetsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const target = await getTargetOrThrow(req.params.id as string);
    await assertProjectAccess(target.projectId, req.user!);
    const input = updateTargetSchema.parse(req.body);
    res.json(await updateTarget(target.id, input, req.user!.id));
  })
);

targetsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const target = await getTargetOrThrow(req.params.id as string);
    await assertProjectAccess(target.projectId, req.user!);
    await deleteTarget(target.id, req.user!.id);
    res.status(204).send();
  })
);
