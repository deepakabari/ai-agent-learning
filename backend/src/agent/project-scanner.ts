import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * Project Scanner
 *
 * Auto-scans a project directory and builds a context summary
 * that gets injected into the agent's system prompt.
 * This gives the AI full awareness of the project's tech stack,
 * structure, and key configuration.
 */

export interface ProjectInfo {
  /** Project name from package.json or folder name. */
  name: string;
  /** Detected tech stack (e.g., ["Node.js", "Fastify", "TypeScript"]). */
  techStack: string[];
  /** File tree (max 4 levels, ignores node_modules etc). */
  fileTree: string;
  /** Total number of source files. */
  fileCount: number;
  /** Key dependencies from package.json. */
  dependencies: Record<string, string>;
  /** Dev dependencies from package.json. */
  devDependencies: Record<string, string>;
  /** npm scripts from package.json. */
  scripts: Record<string, string>;
  /** Formatted summary string for the system prompt. */
  summary: string;
}

const IGNORED = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".nuxt",
  "coverage", ".cache", "__pycache__", ".DS_Store", "Thumbs.db",
]);

/**
 * Scan a project directory and return structured project information.
 */
export async function scanProject(projectPath: string): Promise<ProjectInfo> {
  const absPath = resolve(projectPath);

  if (!existsSync(absPath)) {
    throw new Error(`Project path does not exist: ${absPath}`);
  }

  // --- Read package.json ---
  let pkg: Record<string, unknown> = {};
  const pkgPath = join(absPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    } catch { /* skip */ }
  }

  const name = (pkg["name"] as string) ?? absPath.split(/[\\/]/).pop() ?? "unknown";
  const dependencies = (pkg["dependencies"] as Record<string, string>) ?? {};
  const devDependencies = (pkg["devDependencies"] as Record<string, string>) ?? {};
  const scripts = (pkg["scripts"] as Record<string, string>) ?? {};

  // --- Detect tech stack ---
  const techStack = detectTechStack(absPath, dependencies, devDependencies);

  // --- Build file tree ---
  const treeLines: string[] = [];
  let fileCount = 0;

  async function buildTree(dir: string, prefix: string, depth: number): Promise<void> {
    if (depth > 3 || treeLines.length > 150) return;

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    const items: Array<{ name: string; isDir: boolean }> = [];
    for (const entry of entries) {
      if (IGNORED.has(entry)) continue;
      try {
        const s = await stat(join(dir, entry));
        items.push({ name: entry, isDir: s.isDirectory() });
        if (!s.isDirectory()) fileCount++;
      } catch { /* skip */ }
    }

    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const isLast = i === items.length - 1;
      const connector = isLast ? "└── " : "├── ";
      treeLines.push(`${prefix}${connector}${item.name}${item.isDir ? "/" : ""}`);

      if (item.isDir) {
        await buildTree(
          join(dir, item.name),
          prefix + (isLast ? "    " : "│   "),
          depth + 1
        );
      }
    }
  }

  await buildTree(absPath, "", 0);
  const fileTree = treeLines.join("\n");

  // --- Build summary ---
  const summary = buildSummary({ name, techStack, fileCount, dependencies, scripts, fileTree });

  return {
    name,
    techStack,
    fileTree,
    fileCount,
    dependencies,
    devDependencies,
    scripts,
    summary,
  };
}

/**
 * Detect the tech stack based on files and dependencies.
 */
function detectTechStack(
  projectPath: string,
  deps: Record<string, string>,
  devDeps: Record<string, string>
): string[] {
  const all = { ...deps, ...devDeps };
  const stack: string[] = [];

  // Language
  if (existsSync(join(projectPath, "tsconfig.json")) || all["typescript"]) {
    stack.push("TypeScript");
  }
  if (existsSync(join(projectPath, "package.json"))) {
    stack.push("Node.js");
  }
  if (existsSync(join(projectPath, "requirements.txt")) || existsSync(join(projectPath, "pyproject.toml"))) {
    stack.push("Python");
  }
  if (existsSync(join(projectPath, "go.mod"))) {
    stack.push("Go");
  }

  // Backend Frameworks
  if (all["fastify"]) stack.push("Fastify");
  if (all["express"]) stack.push("Express");
  if (all["nestjs"] || all["@nestjs/core"]) stack.push("NestJS");
  if (all["hono"]) stack.push("Hono");
  if (all["koa"]) stack.push("Koa");

  // Frontend Frameworks
  if (all["react"] || all["react-dom"]) stack.push("React");
  if (all["next"]) stack.push("Next.js");
  if (all["vue"]) stack.push("Vue");
  if (all["svelte"]) stack.push("Svelte");
  if (all["@angular/core"]) stack.push("Angular");

  // Build tools
  if (all["vite"]) stack.push("Vite");
  if (all["webpack"]) stack.push("Webpack");

  // Databases
  if (all["prisma"] || all["@prisma/client"]) stack.push("Prisma");
  if (all["typeorm"]) stack.push("TypeORM");
  if (all["mongoose"]) stack.push("MongoDB/Mongoose");
  if (all["pg"]) stack.push("PostgreSQL");
  if (all["@aws-sdk/client-dynamodb"]) stack.push("DynamoDB");

  // Testing
  if (all["vitest"]) stack.push("Vitest");
  if (all["jest"]) stack.push("Jest");

  // AI/ML
  if (all["@langchain/core"]) stack.push("LangChain");
  if (all["@modelcontextprotocol/sdk"]) stack.push("MCP");

  return stack;
}

/**
 * Build a formatted summary for the agent's system prompt.
 */
function buildSummary(info: {
  name: string;
  techStack: string[];
  fileCount: number;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  fileTree: string;
}): string {
  const parts: string[] = [
    `## Project: ${info.name}`,
    `**Tech Stack:** ${info.techStack.join(", ") || "Unknown"}`,
    `**Files:** ${info.fileCount} source files`,
    "",
  ];

  if (Object.keys(info.scripts).length > 0) {
    parts.push("**Available Scripts:**");
    for (const [name, cmd] of Object.entries(info.scripts)) {
      parts.push(`  - \`npm run ${name}\` → ${cmd}`);
    }
    parts.push("");
  }

  if (Object.keys(info.dependencies).length > 0) {
    parts.push("**Key Dependencies:**");
    const topDeps = Object.keys(info.dependencies).slice(0, 15);
    parts.push(`  ${topDeps.join(", ")}`);
    parts.push("");
  }

  parts.push("**File Structure:**");
  parts.push("```");
  parts.push(info.fileTree);
  parts.push("```");

  return parts.join("\n");
}
