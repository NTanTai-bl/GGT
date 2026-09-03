import { z } from "zod";
import {
  ENVIRONMENTS,
  FINDING_STATUSES,
  PENTEST_REQUESTED_EVENT,
  SCAN_MODES,
  SCAN_TYPES,
  TARGET_TYPES,
} from "./constants";
import { isSupportedSourceTarget } from "./source-target";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

const authorizationConfirmedField = z.literal(true, {
  errorMap: () => ({
    message:
      "You must confirm this target is owned by the company or explicitly authorized for security testing.",
  }),
});

export const createTargetSchema = z
  .object({
    type: z.enum(TARGET_TYPES),
    target: z.string().trim().min(1, "target is required").max(500),
    environment: z.enum(ENVIRONMENTS),
    branch: z.string().trim().max(200).optional(),
    commitSha: z.string().trim().max(100).optional(),
    authorizationConfirmed: authorizationConfirmedField,
  })
  .superRefine((input, ctx) => {
    if (input.type === "SOURCE" && !isSupportedSourceTarget(input.target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target"],
        message: "SOURCE target must be s3://bucket/key.tar.gz or https://github.com/owner/repository",
      });
    }
  });
export type CreateTargetInput = z.infer<typeof createTargetSchema>;

export const updateTargetSchema = z.object({
  environment: z.enum(ENVIRONMENTS).optional(),
  branch: z.string().trim().max(200).optional(),
  commitSha: z.string().trim().max(100).optional(),
  authorizationConfirmed: z.boolean().optional(),
});
export type UpdateTargetInput = z.infer<typeof updateTargetSchema>;

export const createPentestSchema = z.object({
  projectId: z.string().uuid(),
  scanType: z.enum(SCAN_TYPES),
  scanMode: z.enum(SCAN_MODES),
  targetIds: z.array(z.string().uuid()).min(1, "at least one target is required"),
  instruction: z.string().trim().max(4000).optional(),
  credentialSecretArn: z
    .string()
    .trim()
    .regex(/^arn:aws:secretsmanager:/, "must be a Secrets Manager ARN")
    .nullable()
    .optional(),
  authorizationConfirmed: authorizationConfirmedField,
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
});
