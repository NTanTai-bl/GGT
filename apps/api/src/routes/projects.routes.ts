import { Router } from "express";
import { createProjectSchema, createTargetSchema } from "@pentest/shared";
import { asyncHandler } from "./asyncHandler";
import { requireAuth } from "../middleware/auth";
import { createProject, getProjectOrThrow, listProjects } from "../services/project.service";
import { createTarget, listTargets } from "../services/target.service";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    const project = await createProject(input, req.user!.id);
    res.status(201).json(project);
  })
);

projectsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listProjects());
  })
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getProjectOrThrow(req.params.id as string));
  })
);

projectsRouter.post(
  "/:id/targets",
  asyncHandler(async (req, res) => {
    const input = createTargetSchema.parse(req.body);
    const target = await createTarget(req.params.id as string, input, req.user!.id);
    res.status(201).json(target);
  })
);

projectsRouter.get(
  "/:id/targets",
  asyncHandler(async (req, res) => {
    res.json(await listTargets(req.params.id as string));
  })
);
