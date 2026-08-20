import { AuditLog } from "./models";

export interface RecordAuditLogInput {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  /** Safe metadata only — the caller is responsible for never including secrets. */
  metadata?: Record<string, unknown> | null;
}

/** Spec §26 — a queryable record of security-sensitive actions, not just stdout logs. */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  await AuditLog.create({
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
}
