import { simpleGit } from "simple-git";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, mkdirSync } from "node:fs";

/**
 * Repository Cache Directory
 * 
 * Cloned GitHub repos stay here until the container is destroyed.
 * This is using the OS temp directory, which is usually fast (tmpfs).
 */
const REPO_CACHE_DIR = join(tmpdir(), "ai-agent-repos");

if (!existsSync(REPO_CACHE_DIR)) {
  mkdirSync(REPO_CACHE_DIR, { recursive: true });
}

/**
 * Ensures a project path is available locally.
 * 
 * - If the input is a GitHub URL, it clones it to a temporary directory and returns that path.
 * - If the input is a local path, it returns it as-is.
 * 
 * @param inputPath - A local directory path or a GitHub repository URL.
 * @returns The absolute local path to the project.
 * @throws Error if cloning fails.
 */
export async function ensureLocalPath(inputPath: string): Promise<string> {
  // Normalize and check for GitHub URL
  const trimmed = inputPath.trim();
  const isGithub = trimmed.match(/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/\s]+(?:\.git)?\/?$/i);

  if (isGithub) {
    // Hash the URL to create a unique, filesystem-safe directory name
    const hash = createHash("md5").update(trimmed).digest("hex");
    const localDir = join(REPO_CACHE_DIR, hash);

    // If already cloned, just return the path
    if (existsSync(localDir)) {
      return localDir;
    }

    // Clone the repository (depth=1 for speed and space efficiency)
    try {
      const git = simpleGit();
      await git.clone(trimmed, localDir, ["--depth", "1"]);
      return localDir;
    } catch (error) {
      throw new Error(
        `Failed to clone GitHub repository: ${error instanceof Error ? error.message : "Internal Error"}`
      );
    }
  }

  // Return local path as-is (backend will verify existence during scan)
  return trimmed;
}
