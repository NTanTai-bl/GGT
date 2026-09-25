jest.mock("node:child_process", () => ({
  execFile: jest.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, out: string, errOut: string) => void) =>
    cb(null, "", "")
  ),
}));

import { execFile } from "node:child_process";
import { cloneGitHubSource, hasGitRef } from "../git-source";

const mockedExecFile = execFile as unknown as jest.Mock;
const repo = "https://github.com/NTanTai-bl/GGT-demo";

beforeEach(() => jest.clearAllMocks());

describe("cloneGitHubSource", () => {
  it("clones the pinned branch and checks out the commit with argv only", async () => {
    await cloneGitHubSource(repo, "/ws/repo-1", { branch: "release/1.2", commitSha: "f19f7e1" });

    expect(mockedExecFile).toHaveBeenNthCalledWith(
      1,
      "git",
      ["clone", "--filter=blob:none", "--no-tags", "--branch=release/1.2", "--single-branch", "--", repo, "/ws/repo-1"],
      expect.objectContaining({ env: expect.objectContaining({ GIT_TERMINAL_PROMPT: "0" }) }),
      expect.any(Function)
    );
    expect(mockedExecFile).toHaveBeenNthCalledWith(
      2,
      "git",
      ["-C", "/ws/repo-1", "-c", "advice.detachedHead=false", "checkout", "--detach", "f19f7e1"],
      expect.anything(),
      expect.any(Function)
    );
  });

  it("refuses option-like branches, non-hex SHAs and non-GitHub URLs before running git", async () => {
    await expect(cloneGitHubSource(repo, "/ws/r", { branch: "--upload-pack=touch /tmp/x" })).rejects.toThrow("branch");
    await expect(cloneGitHubSource(repo, "/ws/r", { commitSha: "HEAD~1" })).rejects.toThrow("commitSha");
    await expect(cloneGitHubSource("https://gitlab.com/a/b", "/ws/r", { branch: "main" })).rejects.toThrow("github.com");
    expect(mockedExecFile).not.toHaveBeenCalled();
  });

  it("only treats a non-empty branch or commit as a pinned revision", () => {
    expect(hasGitRef({ branch: null, commitSha: "" })).toBe(false);
    expect(hasGitRef({ branch: "main" })).toBe(true);
  });
});
