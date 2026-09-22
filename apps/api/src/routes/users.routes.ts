import { Router } from "express";
import { z } from "zod";
import {
  assignUserProjectsSchema,
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "@pentest/shared";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "./asyncHandler";
import {
  assignUserProjects,
  createUser,
  getUserOrThrow,
  listUserAuditLogs,
  listUsers,
  resetUserPassword,
  updateUser,
} from "../services/user.service";

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.use(requirePermission("USER_MANAGE"));

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listUsers());
  })
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createUserSchema.parse(req.body);
    res.status(201).json(await createUser(input, req.user!.id));
  })
);

usersRouter.get(
  "/:id/audit-logs",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);
    res.json(await listUserAuditLogs(req.params.id as string, query.limit, query.offset));
  })
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getUserOrThrow(req.params.id as string));
  })
);

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateUserSchema.parse(req.body);
    res.json(await updateUser(req.params.id as string, input, req.user!.id));
  })
);

usersRouter.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    const input = resetUserPasswordSchema.parse(req.body);
    await resetUserPassword(req.params.id as string, input, req.user!.id);
    res.status(204).send();
  })
);

usersRouter.put(
  "/:id/projects",
  asyncHandler(async (req, res) => {
    const input = assignUserProjectsSchema.parse(req.body);
    res.json(await assignUserProjects(req.params.id as string, input, req.user!.id));
  })
);

// Accounts are intentionally retained for audit integrity. Disable an account instead.
usersRouter.delete("/:id", (_req, res) => {
  res.status(405).json({ error: "User deletion is disabled; lock the account instead" });
});
