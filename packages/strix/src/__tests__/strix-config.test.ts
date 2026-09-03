import { loadLlmConfigFromEnv, strixMaxBudgetUsdFromEnv } from "../strix-config";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("loadLlmConfigFromEnv", () => {
  it("throws if STRIX_LLM is not set", () => {
    delete process.env.STRIX_LLM;
    expect(() => loadLlmConfigFromEnv()).toThrow(/STRIX_LLM/);
  });

  it("loads an openrouter config for local dev", () => {
    process.env.STRIX_LLM = "openrouter/free";
    delete process.env.LLM_API_KEY;
    expect(loadLlmConfigFromEnv()).toEqual({ strixLlm: "openrouter/free", apiKey: undefined, apiBase: undefined });
  });

  it("rejects a Bedrock config that also sets LLM_API_KEY", () => {
    process.env.STRIX_LLM = "bedrock/anthropic.claude-3-sonnet";
    process.env.LLM_API_KEY = "should-not-be-set";
    expect(() => loadLlmConfigFromEnv()).toThrow(/IAM role/);
  });

  it("allows a Bedrock config with no key (IAM role auth)", () => {
    process.env.STRIX_LLM = "bedrock/anthropic.claude-3-sonnet";
    delete process.env.LLM_API_KEY;
    expect(() => loadLlmConfigFromEnv()).not.toThrow();
  });
});

describe("strixMaxBudgetUsdFromEnv", () => {
  it("defaults to the mandatory $3 per-run cap", () => {
    delete process.env.STRIX_MAX_BUDGET_USD;
    expect(strixMaxBudgetUsdFromEnv()).toBe(3);
  });

  it("loads a positive configured cap", () => {
    process.env.STRIX_MAX_BUDGET_USD = "2.5";
    expect(strixMaxBudgetUsdFromEnv()).toBe(2.5);
  });

  it.each(["0", "-1", "not-a-number"])("rejects invalid cap %s", (value) => {
    process.env.STRIX_MAX_BUDGET_USD = value;
    expect(() => strixMaxBudgetUsdFromEnv()).toThrow(/positive number/);
  });
});
