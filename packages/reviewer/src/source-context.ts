import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { sanitizeText } from "./sanitizer";

const MAX_SOURCE_FILE_BYTES = 1_000_000;
const MAX_CONTEXT_CHARS = 20_000;
const DENIED_SOURCE_BASENAMES = new Set([".env", ".npmrc", ".pypirc"]);
const DENIED_SOURCE_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx"]);

export async function loadSourceContext(
  rawFinding: unknown,
  workspaceDir: string,
  extraRoots: string[] = []
): Promise<string> {
  if (!rawFinding || typeof rawFinding !== "object") return "";
  const locations = (rawFinding as Record<string, unknown>).code_locations;
  if (!Array.isArray(locations)) return "";

  const contexts: string[] = [];
  for (const location of locations.slice(0, 3)) {
    if (!location || typeof location !== "object") continue;
    const item = location as Record<string, unknown>;
    const file = typeof item.file === "string" ? item.file : "unknown";
    const snippet = typeof item.snippet === "string" ? item.snippet : "";
    const diskContent = await tryReadWorkspaceFile(workspaceDir, file, extraRoots);
    const content = diskContent || snippet;
    if (!content) continue;
    contexts.push(`FILE: ${sanitizeText(file, 500)}\n${sanitizeText(content, MAX_CONTEXT_CHARS)}`);
  }
  return contexts.join("\n\n").slice(0, MAX_CONTEXT_CHARS);
}

async function tryReadWorkspaceFile(
  workspaceDir: string,
  relativeFile: string,
  extraRoots: string[]
): Promise<string | null> {
  if (path.isAbsolute(relativeFile) || relativeFile.includes("\0")) return null;
  const basename = path.basename(relativeFile).toLowerCase();
  if (DENIED_SOURCE_BASENAMES.has(basename) || DENIED_SOURCE_EXTENSIONS.has(path.extname(basename))) return null;

  // Strix reports code_locations[].file relative to the repository root.
  for (const root of [...extraRoots, path.join(workspaceDir, "source"), workspaceDir]) {
    const resolvedRoot = path.resolve(root);
    const candidate = path.resolve(resolvedRoot, relativeFile);
    if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path.sep}`)) continue;
    try {
      const fileStat = await stat(candidate);
      if (!fileStat.isFile() || fileStat.size > MAX_SOURCE_FILE_BYTES) continue;
      return await readFile(candidate, "utf8");
    } catch {
      // The Strix finding may contain a snippet even when the repository is only inside its sandbox.
    }
  }
  return null;
}
