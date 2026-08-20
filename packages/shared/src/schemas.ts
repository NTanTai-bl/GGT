import { z } from "zod";
import {
  ENVIRONMENTS,
  FINDING_STATUSES,
  PENTEST_REQUESTED_EVENT,
  SCAN_MODES,
  TARGET_TYPES,
} from "./constants";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const createTargetSchema = z.object({
  type: z.enum(TARGET_TYPES),
  target: z.string().trim().min(1, "target is required").max(500),
  environment: z.enum(ENVIRONMENTS),
  authorizationConfirmed: z.literal(true, {
    errorMap: () => ({
      message:
        "You must confirm you own this application or have explicit authorization to test it.",
    }),
  }),
});
export type CreateTargetInput = z.infer<typeof createTargetSchema>;

export const createPentestSchema = z.object({
  projectId: z.string().uuid(),
  targetId: z.string().uuid(),
  scanMode: z.enum(SCAN_MODES),
  instruction: z.string().trim().max(4000).optional(),
});
export type CreatePentestInput = z.infer<typeof createPentestSchema>;

export const updateFindingSchema = z.object({
  status: z.enum(FINDING_STATUSES).optional(),
});
export type UpdateFindingInput = z.infer<typeof updateFindingSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const pentestRequestedMessageSchema = z.object({
  eventType: z.literal(PENTEST_REQUESTED_EVENT),
  runId: z.string().uuid(),
  projectId: z.string().uuid(),
  targetId: z.string().uuid(),
  target: z.string().min(1),
  scanMode: z.enum(SCAN_MODES),
  instruction: z.string().optional(),
});
