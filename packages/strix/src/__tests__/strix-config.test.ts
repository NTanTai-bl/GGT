import { buildStrixArgs, buildStrixEnv } from "../strix-config";

describe("buildStrixArgs", () => {
  it("builds the documented flag set for a standard scan", () => {
    const args = buildStrixArgs({ runId: "r1", target: "https://staging.example.com", scanMode: "STANDARD" });
    expect(args).toEqual([
      "--target",
      "https://staging.example.com",
      "--scan-mode",
      "standard",
      "--non-interactive",
    ]);
  });

  it("keeps a hostile instruction as a single argv element instead of shell-interpolating it", () => {
    const hostile = "focus on auth; rm -rf / #";
    const args = buildStrixArgs({
      runId: "r1",
      target: "https://staging.example.com",
      scanMode: "QUICK",
      instruction: hostile,
    });
    // The whole hostile string must survive as ONE array element — proof
    // it will reach execve() as a single argv entry, never a shell string.
    expect(args).toContain(hostile);
    expect(args.filter((a) => a === hostile)).toHaveLength(1);
  });
});

describe("buildStrixEnv", () => {
  it("injects LLM config into the child env without touching argv", () => {
    const env = buildStrixEnv({ strixLlm: "openrouter/free", apiKey: "secret-key" });
    expect(env.STRIX_LLM).toBe("openrouter/free");
    expect(env.LLM_API_KEY).toBe("secret-key");
  });
});
