import { createTargetSchema } from "@pentest/shared";

describe("createTargetSchema", () => {
  it("rejects a target where authorization is not explicitly confirmed", () => {
    const result = createTargetSchema.safeParse({
      type: "URL",
      target: "https://staging.example.com",
      environment: "STAGING",
      authorizationConfirmed: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a target that omits the authorization field entirely", () => {
    const result = createTargetSchema.safeParse({
      type: "URL",
      target: "https://staging.example.com",
      environment: "STAGING",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a target with explicit authorization confirmed", () => {
    const result = createTargetSchema.safeParse({
      type: "URL",
      target: "https://staging.example.com",
      environment: "STAGING",
      authorizationConfirmed: true,
    });
    expect(result.success).toBe(true);
  });
});
