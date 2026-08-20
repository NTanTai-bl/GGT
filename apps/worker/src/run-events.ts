import { Run, RunEvent } from "@pentest/database";

/** Appends one timeline entry (spec §18) and updates the run's denormalized "current stage". */
export async function emitEvent(runId: string, event: string, message?: string): Promise<void> {
  await RunEvent.create({ runId, event, message: message ?? null });
  await Run.update({ currentStage: event }, { where: { id: runId } });
}
