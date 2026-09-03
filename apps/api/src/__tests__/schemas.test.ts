import { createPentestSchema, createTargetSchema } from "@pentest/shared";

describe("createTargetSchema", () => {
  it("rejects a target where authorization is not explicitly confirmed", () => {
    const result = createTargetSchema.safeParse({
      type: "WEB",
      target: "https://staging.example.internal",
      environment: "STAGING",
      authorizationConfirmed: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a target that omits the authorization field entirely", () => {
    const result = createTargetSchema.safeParse({
      type: "WEB",
      target: "https://staging.example.internal",
      environment: "STAGING",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a target with explicit authorization confirmed", () => {
    const result = createTargetSchema.safeParse({
      type: "WEB",
      target: "https://staging.example.internal",
      environment: "STAGING",
      authorizationConfirmed: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a SOURCE target with branch and commit metadata", () => {
    const result = createTargetSchema.safeParse({
      type: "SOURCE",
      target: "s3://ggt-source/project-a/a83ec45.tar.gz",
      environment: "STAGING",
      branch: "main",
      commitSha: "a83ec45",
      authorizationConfirmed: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a canonical GitHub repository URL as a SOURCE target", () => {
    const result = createTargetSchema.safeParse({
      type: "SOURCE",
      target: "https://github.com/NTanTai-bl/GGT",
      environment: "STAGING",
      branch: "main",
      authorizationConfirmed: true,
    });
    expect(result.success).toBe(true);
  });

  it.each([
    "https://example.com/org/repo",
    "http://github.com/org/repo",
    "https://github.com/org/repo/issues",
    "not-a-repository",
  ])("rejects unsupported SOURCE target %s", (target) => {
    const result = createTargetSchema.safeParse({
      type: "SOURCE",
      target,
      environment: "STAGING",
      authorizationConfirmed: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("createPentestSchema", () => {
  it("rejects a credentialSecretArn that isn't a Secrets Manager ARN", () => {
    const result = createPentestSchema.safeParse({
      projectId: "11111111-1111-1111-1111-111111111111",
      scanType: "AUTHENTICATED",
      scanMode: "STANDARD",
      targetIds: ["22222222-2222-2222-2222-222222222222"],
      credentialSecretArn: "not-an-arn",
      authorizationConfirmed: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed request with a real Secrets Manager ARN", () => {
    const result = createPentestSchema.safeParse({
      projectId: "11111111-1111-1111-1111-111111111111",
      scanType: "AUTHENTICATED",
      scanMode: "STANDARD",
      targetIds: ["22222222-2222-2222-2222-222222222222"],
      credentialSecretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:ggt/test-account",
      authorizationConfirmed: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a request with no targets", () => {
    const result = createPentestSchema.safeParse({
      projectId: "11111111-1111-1111-1111-111111111111",
      scanType: "BLACK_BOX",
      scanMode: "STANDARD",
      targetIds: [],
      authorizationConfirmed: true,
    });
    expect(result.success).toBe(false);
  });
});
