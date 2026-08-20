import { can } from "../rbac";

describe("can", () => {
  it("lets ADMIN do everything", () => {
    expect(can("ADMIN", "PENTEST_CREATE")).toBe(true);
    expect(can("ADMIN", "FINDING_MARK_FIXED_PENDING_RETEST")).toBe(true);
  });

  it("lets SECURITY create and cancel pentests", () => {
    expect(can("SECURITY", "PENTEST_CREATE")).toBe(true);
    expect(can("SECURITY", "PENTEST_CANCEL")).toBe(true);
  });

  it("does not let DEVELOPER create pentests", () => {
    expect(can("DEVELOPER", "PENTEST_CREATE")).toBe(false);
  });

  it("lets DEVELOPER mark a finding as FIXED_PENDING_RETEST only", () => {
    expect(can("DEVELOPER", "FINDING_MARK_FIXED_PENDING_RETEST")).toBe(true);
    expect(can("DEVELOPER", "FINDING_UPDATE_ANY_STATUS")).toBe(false);
  });

  it("gives VIEWER no write permissions", () => {
    expect(can("VIEWER", "PENTEST_CREATE")).toBe(false);
    expect(can("VIEWER", "FINDING_MARK_FIXED_PENDING_RETEST")).toBe(false);
  });
});
