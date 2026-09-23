import { Router } from "express";
import { createProjectSchema, createTargetSchema, updateProjectSchema } from "@pentest/shared";
import { asyncHandler } from "./asyncHandler";
import { requireAuth } from "../middleware/auth";
import { assertProjectAccess, requirePermission } from "../middleware/rbac";
import { createProject, getProjectOrThrow, listProjects, updateProject } from "../services/project.service";
import { createTarget, listTargets } from "../services/target.service";
import { HttpError } from "../middleware/errorHandler";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.post(
  "/",
  requirePermission("PROJECT_MANAGE"),
  asyncHandler(async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    const project = await createProject(input, req.user!.id);
    res.status(201).json(project);
  })
);

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listProjects(req.user!));
  })
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertProjectAccess(req.params.id as string, req.user!);
    res.json(await getProjectOrThrow(req.params.id as string));
  })
);

projectsRouter.patch(
  "/:id",
  requirePermission("PROJECT_MANAGE"),
  asyncHandler(async (req, res) => {
    const input = updateProjectSchema.parse(req.body);
    if (input.memberIds !== undefined && req.user!.role !== "ADMIN") {
      throw new HttpError(403, "Only administrators can manage project membership");
    }
    res.json(await updateProject(req.params.id as string, input, req.user!.id));
  })
);

projectsRouter.post(
  "/:id/targets",
  requirePermission("TARGET_MANAGE"),
  asyncHandler(async (req, res) => {
    const input = createTargetSchema.parse(req.body);
    const target = await createTarget(req.params.id as string, input, req.user!.id);
    res.status(201).json(target);
  })
);

projectsRouter.get(
  "/:id/targets",
  asyncHandler(async (req, res) => {
    await assertProjectAccess(req.params.id as string, req.user!);
    res.json(await listTargets(req.params.id as string));
  })
);
