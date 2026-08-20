import { validateScanTypeTargets } from "../scan-type-rules";

// Exact matrix from the GGT spec §32 "Scan mode validation".
describe("validateScanTypeTargets", () => {
  it("rejects SOURCE_REVIEW with only a WEB target", () => {
    expect(validateScanTypeTargets("SOURCE_REVIEW", ["WEB"], false).valid).toBe(false);
  });

  it("accepts SOURCE_REVIEW with a SOURCE target", () => {
    expect(validateScanTypeTargets("SOURCE_REVIEW", ["SOURCE"], false).valid).toBe(true);
  });

  it("rejects BLACK_BOX with only a SOURCE target", () => {
    expect(validateScanTypeTargets("BLACK_BOX", ["SOURCE"], false).valid).toBe(false);
  });

  it("accepts BLACK_BOX with a WEB target", () => {
    expect(validateScanTypeTargets("BLACK_BOX", ["WEB"], false).valid).toBe(true);
  });

  it("accepts BLACK_BOX with an API target", () => {
    expect(validateScanTypeTargets("BLACK_BOX", ["API"], false).valid).toBe(true);
  });

  it("rejects AUTHENTICATED without a credential secret ARN", () => {
    expect(validateScanTypeTargets("AUTHENTICATED", ["WEB"], false).valid).toBe(false);
  });

  it("accepts AUTHENTICATED with a WEB target and a credential", () => {
    expect(validateScanTypeTargets("AUTHENTICATED", ["WEB"], true).valid).toBe(true);
  });

  it("rejects WHITE_BOX without a SOURCE target", () => {
    expect(validateScanTypeTargets("WHITE_BOX", ["WEB"], false).valid).toBe(false);
  });

  it("rejects WHITE_BOX without a WEB/API target", () => {
    expect(validateScanTypeTargets("WHITE_BOX", ["SOURCE"], false).valid).toBe(false);
  });

  it("accepts WHITE_BOX with SOURCE + WEB", () => {
    expect(validateScanTypeTargets("WHITE_BOX", ["SOURCE", "WEB"], false).valid).toBe(true);
  });
});
