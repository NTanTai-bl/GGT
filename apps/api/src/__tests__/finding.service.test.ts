jest.mock("@pentest/database", () => ({
  Finding: { findByPk: jest.fn() },
  Run: { findByPk: jest.fn() },
  Target: {},
  ProjectMember: { findOne: jest.fn() },
  recordAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { Finding, ProjectMember, recordAuditLog, Run } from "@pentest/database";
import { updateFinding } from "../services/finding.service";
import { HttpError } from "../middleware/errorHandler";
import type { AuthenticatedUser } from "../middleware/auth";

const mockedFinding = Finding as unknown as { findByPk: jest.Mock };
const mockedRun = Run as unknown as { findByPk: jest.Mock };
const mockedMembership = ProjectMember as unknown as { findOne: jest.Mock };
const mockedAudit = recordAuditLog as jest.Mock;

function user(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return { id: "user-1", email: "u@example.com", role };
}

function makeFinding(status = "OPEN") {
  return { id: "finding-1", runId: "run-1", status, update: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedRun.findByPk.mockResolvedValue({ id: "run-1", projectId: "project-1" });
  mockedMembership.findOne.mockResolvedValue({ id: "membership-1" });
});

describe("updateFinding — role-based status transitions (spec §25)", () => {
  it("lets SECURITY set any status", async () => {
    const finding = makeFinding();
    mockedFinding.findByPk.mockResolvedValue(finding);
    await updateFinding("finding-1", { status: "FALSE_POSITIVE" }, user("SECURITY"));
    expect(finding.update).toHaveBeenCalledWith({ status: "FALSE_POSITIVE" });
    expect(mockedAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "FINDING_FALSE_POSITIVE" }));
  });

  it("lets DEVELOPER set FIXED_PENDING_RETEST", async () => {
    const finding = makeFinding("CONFIRMED");
    mockedFinding.findByPk.mockResolvedValue(finding);
    await updateFinding("finding-1", { status: "FIXED_PENDING_RETEST" }, user("DEVELOPER"));
    expect(finding.update).toHaveBeenCalledWith({ status: "FIXED_PENDING_RETEST" });
    expect(mockedAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "FINDING_MARKED_FIXED" }));
  });

  it("rejects DEVELOPER trying to set any other status", async () => {
    const finding = makeFinding();
    mockedFinding.findByPk.mockResolvedValue(finding);
    await expect(updateFinding("finding-1", { status: "CONFIRMED" }, user("DEVELOPER"))).rejects.toBeInstanceOf(
      HttpError
    );
    expect(finding.update).not.toHaveBeenCalled();
  });

  it("rejects VIEWER entirely", async () => {
    const finding = makeFinding();
    mockedFinding.findByPk.mockResolvedValue(finding);
    await expect(updateFinding("finding-1", { status: "CONFIRMED" }, user("VIEWER"))).rejects.toBeInstanceOf(
      HttpError
    );
  });

  it("hides a finding from a user who is not a member of its project", async () => {
    const finding = makeFinding();
    mockedFinding.findByPk.mockResolvedValue(finding);
    mockedMembership.findOne.mockResolvedValue(null);

    await expect(updateFinding("finding-1", { status: "FIXED_PENDING_RETEST" }, user("DEVELOPER")))
      .rejects.toMatchObject({ status: 404 });
    expect(finding.update).not.toHaveBeenCalled();
  });
});
