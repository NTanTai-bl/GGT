import { isGitHubRepositoryUrl, isS3SourceUri, isSupportedSourceTarget } from "../source-target";

describe("source target validation", () => {
  it.each([
    "https://github.com/owner/repository",
    "https://github.com/owner/repository.git",
    "https://github.com/owner/repository/",
  ])("accepts canonical GitHub repository URL %s", (value) => {
    expect(isGitHubRepositoryUrl(value)).toBe(true);
    expect(isSupportedSourceTarget(value)).toBe(true);
  });

  it.each([
    "http://github.com/owner/repository",
    "https://github.com/owner/repository/issues",
    "https://user:password@github.com/owner/repository",
    "https://example.com/owner/repository",
  ])("rejects unsafe or unsupported repository URL %s", (value) => {
    expect(isGitHubRepositoryUrl(value)).toBe(false);
  });

  it("accepts a non-empty S3 object URI", () => {
    expect(isS3SourceUri("s3://ggt-pentest-artifacts/source/repository.tar.gz")).toBe(true);
  });
});
