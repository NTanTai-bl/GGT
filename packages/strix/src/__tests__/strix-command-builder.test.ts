import { buildStrixArgs, buildStrixEnv } from "../strix-command-builder";

describe("buildStrixArgs", () => {
  it("builds -n, one -t per target, and --scan-mode for BLACK_BOX", () => {
    const args = buildStrixArgs({
      runId: "r1",
      scanType: "BLACK_BOX",
      scanMode: "STANDARD",
      targets: [{ type: "WEB", url: "https://staging.example.internal" }],
    });
    expect(args).toEqual(["-n", "-t", "https://staging.example.internal", "--scan-mode", "standard"]);
  });

  it("repeats -t for each target in a WHITE_BOX scan (source + web)", () => {
    const args = buildStrixArgs({
      runId: "r1",
      scanType: "WHITE_BOX",
      scanMode: "DEEP",
      targets: [
        { type: "SOURCE", path: "/opt/ggt/workspaces/r1/source" },
        { type: "WEB", url: "https://staging.example.internal" },
      ],
    });
    expect(args).toEqual([
      "-n",
      "-t",
      "/opt/ggt/workspaces/r1/source",
      "-t",
      "https://staging.example.internal",
      "--scan-mode",
      "deep",
    ]);
  });

  it("keeps a hostile instruction as a single argv element instead of shell-interpolating it", () => {
    const hostile = "focus on auth; rm -rf / #";
    const args = buildStrixArgs({
      runId: "r1",
      scanType: "BLACK_BOX",
      scanMode: "QUICK",
      targets: [{ type: "WEB", url: "https://staging.example.internal" }],
      instruction: hostile,
    });
    // The whole hostile string must survive as ONE array element — proof it
    // reaches execve() as a single argv entry, never a shell string.
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

  it("always disables Strix telemetry", () => {
    const env = buildStrixEnv({ strixLlm: "bedrock/anthropic.claude-3" });
    expect(env.STRIX_TELEMETRY).toBe("0");
  });

  it("merges extraEnv (e.g. a short-lived credential file path) without exposing it as a CLI arg", () => {
    const env = buildStrixEnv(
      { strixLlm: "openrouter/free" },
      { GGT_CREDENTIAL_FILE: "/opt/ggt/workspaces/r1/credential.json" }
    );
    expect(env.GGT_CREDENTIAL_FILE).toBe("/opt/ggt/workspaces/r1/credential.json");
  });
});
