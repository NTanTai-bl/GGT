jest.mock("@pentest/database", () => ({
  User: { findByPk: jest.fn(), findAll: jest.fn(), sequelize: null },
  Project: {},
  ProjectMember: {},
  AuditLog: {},
  recordAuditLog: jest.fn(),
}));

import { User } from "@pentest/database";
import { updateUser } from "../services/user.service";

const mockedUser = User as unknown as {
  findByPk: jest.Mock;
  findAll: jest.Mock;
  sequelize: { transaction: jest.Mock } | null;
};

beforeEach(() => {
  jest.clearAllMocks();
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  mockedUser.sequelize = { transaction: jest.fn((callback) => callback(transaction)) };
});

describe("updateUser — last administrator protection", () => {
  it("does not allow the last active admin to be demoted", async () => {
    mockedUser.findByPk.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isActive: true,
      displayName: "Admin",
      update: jest.fn(),
    });
    mockedUser.findAll.mockResolvedValue([{ id: "admin-1" }]);

    await expect(updateUser("admin-1", { role: "SECURITY" }, "admin-1"))
      .rejects.toMatchObject({ status: 409 });
  });

  it("does not allow the last active admin to be locked", async () => {
    mockedUser.findByPk.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      isActive: true,
      displayName: "Admin",
      update: jest.fn(),
    });
    mockedUser.findAll.mockResolvedValue([{ id: "admin-1" }]);

    await expect(updateUser("admin-1", { isActive: false }, "admin-1"))
      .rejects.toMatchObject({ status: 409 });
  });
});
