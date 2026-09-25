jest.mock("@pentest/database", () => ({
  Target: { findByPk: jest.fn() },
  RunTarget: { findOne: jest.fn() },
  Run: {},
  recordAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { RunTarget, Target } from "@pentest/database";
import { deleteTarget } from "../services/target.service";

const mockedTarget = Target as unknown as { findByPk: jest.Mock };
const mockedRunTarget = RunTarget as unknown as { findOne: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe("deleteTarget", () => {
  it("refuses to delete a target that an active run is still using", async () => {
    const destroy = jest.fn();
    mockedTarget.findByPk.mockResolvedValue({ id: "target-1", destroy });
    mockedRunTarget.findOne.mockResolvedValue({ targetId: "target-1", run: { status: "RUNNING" } });

    await expect(deleteTarget("target-1", "user-1")).rejects.toMatchObject({ status: 409 });
    expect(destroy).not.toHaveBeenCalled();
  });

  it("deletes a target with no active run", async () => {
    const destroy = jest.fn();
    mockedTarget.findByPk.mockResolvedValue({ id: "target-1", destroy });
    mockedRunTarget.findOne.mockResolvedValue(null);

    await deleteTarget("target-1", "user-1");
    expect(destroy).toHaveBeenCalled();
  });
});
