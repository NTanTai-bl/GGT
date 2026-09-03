const S3_SOURCE_URI_PATTERN = /^s3:\/\/[^/]+\/.+$/;
const GITHUB_SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;

export function isS3SourceUri(value: string): boolean {
  return S3_SOURCE_URI_PATTERN.test(value);
}

/**
 * Only accept a canonical HTTPS GitHub repository URL. Keeping this narrow
 * prevents SOURCE targets from becoming an arbitrary URL fetch mechanism.
 */
export function isGitHubRepositoryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return false;
    }

    const segments = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    if (segments.length !== 2) return false;

    const [owner, rawRepository] = segments;
    const repository = rawRepository?.endsWith(".git") ? rawRepository.slice(0, -4) : rawRepository;
    return Boolean(
      owner &&
        repository &&
        GITHUB_SEGMENT_PATTERN.test(owner) &&
        GITHUB_SEGMENT_PATTERN.test(repository)
    );
  } catch {
    return false;
  }
}

export function isSupportedSourceTarget(value: string): boolean {
  return isS3SourceUri(value) || isGitHubRepositoryUrl(value);
}
