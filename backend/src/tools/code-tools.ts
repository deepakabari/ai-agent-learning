import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  readFile,
  writeFile,
  readdir,
  stat,
  mkdir,
} from "node:fs/promises";
import { resolve, join, relative, extname } from "node:path";
import { execSync } from "node:child_process";

/**
 * Code Assistant Tools
 *
 * 6 LangChain-compatible tools that let the AI agent interact
 * with any project on the user's machine.
 *
 * All file operations are sandboxed to the specified `projectPath`.
 */

/** Directories/files to always ignore when listing trees. */
const IGNORED = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".nuxt",
  "coverage", ".cache", "__pycache__", ".DS_Store", "Thumbs.db",
  ".env", ".env.local", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
]);

/** Commands allowed in run_command. */
const ALLOWED_COMMANDS = [
  "npm", "npx", "node", "git", "tsc", "eslint", "prettier",
  "vitest", "jest", "cat", "echo", "ls", "dir", "type",
];

// ─────────────────────────────────────────────
// Utility: Path Validation
// ─────────────────────────────────────────────

function validatePath(projectPath: string, filePath: string): string {
  const resolved = resolve(projectPath, filePath);
  if (!resolved.startsWith(resolve(projectPath))) {
    throw new Error("Access denied: path traversal detected.");
  }
  return resolved;
}

// ─────────────────────────────────────────────
// Tool 1: read_file
// ─────────────────────────────────────────────

export const readFileTool = tool(
  async ({ filePath, projectPath }) => {
    try {
      const safePath = validatePath(projectPath, filePath);
      const content = await readFile(safePath, "utf-8");
      const lines = content.split("\n");
      const numbered = lines
        .map((line, i) => `${i + 1}: ${line}`)
        .join("\n");

      // Truncate large files
      if (numbered.length > 80_000) {
        return `File: ${filePath} (${lines.length} lines, truncated)\n\n${numbered.slice(0, 80_000)}\n\n... [truncated at 80KB]`;
      }

      return `File: ${filePath} (${lines.length} lines)\n\n${numbered}`;
    } catch (error: unknown) {
      return `Error reading ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  },
  {
    name: "read_file",
    description:
      "Read the contents of a file in the project. Returns the file content with line numbers. Use this to understand existing code before making changes.",
    schema: z.object({
      filePath: z.string().describe("Path to the file, relative to project root. Example: 'src/index.ts'"),
      projectPath: z.string().describe("Absolute path to the project directory"),
    }),
  }
);

// ─────────────────────────────────────────────
// Tool 2: write_file
// ─────────────────────────────────────────────

export const writeFileTool = tool(
  async ({ filePath, content, projectPath }) => {
    try {
      const safePath = validatePath(projectPath, filePath);
      const dir = resolve(safePath, "..");
      await mkdir(dir, { recursive: true });
      await writeFile(safePath, content, "utf-8");
      return `✅ Successfully wrote ${filePath} (${content.split("\n").length} lines)`;
    } catch (error: unknown) {
      return `Error writing ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  },
  {
    name: "write_file",
    description:
      "Create a new file or overwrite an existing file with the given content. Parent directories will be created automatically. Use this to generate new code files.",
    schema: z.object({
      filePath: z.string().describe("Path to the file, relative to project root. Example: 'src/routes/auth.ts'"),
      content: z.string().describe("The complete file content to write"),
      projectPath: z.string().describe("Absolute path to the project directory"),
    }),
  }
);

// ─────────────────────────────────────────────
// Tool 3: edit_file
// ─────────────────────────────────────────────

export const editFileTool = tool(
  async ({ filePath, searchText, replaceText, projectPath }) => {
    try {
      const safePath = validatePath(projectPath, filePath);
      const content = await readFile(safePath, "utf-8");

      if (!content.includes(searchText)) {
        return `Error: Could not find the search text in ${filePath}. Make sure the text matches exactly (including whitespace and newlines).`;
      }

      const updated = content.replace(searchText, replaceText);
      await writeFile(safePath, updated, "utf-8");

      return `✅ Successfully edited ${filePath} — replaced ${searchText.split("\n").length} lines`;
    } catch (error: unknown) {
      return `Error editing ${filePath}: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  },
  {
    name: "edit_file",
    description:
      "Edit an existing file by finding and replacing specific text. The searchText must match exactly. Use read_file first to see the current content, then use this to make surgical edits.",
    schema: z.object({
      filePath: z.string().describe("Path to the file, relative to project root"),
      searchText: z.string().describe("The exact text to find in the file (must match exactly, including whitespace)"),
      replaceText: z.string().describe("The replacement text"),
      projectPath: z.string().describe("Absolute path to the project directory"),
    }),
  }
);

// ─────────────────────────────────────────────
// Tool 4: search_code
// ─────────────────────────────────────────────

export const searchCodeTool = tool(
  async ({ query, projectPath, filePattern }) => {
    try {
      const results: string[] = [];
      const searchDir = resolve(projectPath);

      async function searchInDir(dir: string, depth = 0): Promise<void> {
        if (depth > 6 || results.length > 30) return;

        const entries = await readdir(dir);
        for (const entry of entries) {
          if (IGNORED.has(entry)) continue;
          const fullPath = join(dir, entry);

          try {
            const stats = await stat(fullPath);

            if (stats.isDirectory()) {
              await searchInDir(fullPath, depth + 1);
            } else if (stats.isFile()) {
              // Apply file pattern filter
              if (filePattern && !entry.match(new RegExp(filePattern.replace("*", ".*")))) {
                continue;
              }

              const ext = extname(entry).toLowerCase();
              const textExts = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html", ".yml", ".yaml", ".env", ".sh", ".sql", ".py", ".go", ".rs"];
              if (!textExts.includes(ext) && ext !== "") continue;

              const content = await readFile(fullPath, "utf-8");
              const lines = content.split("\n");

              for (let i = 0; i < lines.length; i++) {
                if (lines[i]!.includes(query)) {
                  const relPath = relative(searchDir, fullPath);
                  results.push(`${relPath}:${i + 1}: ${lines[i]!.trim()}`);
                  if (results.length >= 30) return;
                }
              }
            }
          } catch {
            // Skip unreadable files
          }
        }
      }

      await searchInDir(searchDir);

      if (results.length === 0) {
        return `No results found for "${query}" in the project.`;
      }

      return `Found ${results.length} match(es) for "${query}":\n\n${results.join("\n")}`;
    } catch (error: unknown) {
      return `Error searching: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  },
  {
    name: "search_code",
    description:
      "Search for text across all code files in the project. Like grep. Returns matching lines with file paths and line numbers. Use this to find where things are defined, imported, or used.",
    schema: z.object({
      query: z.string().describe("The text to search for across all files"),
      projectPath: z.string().describe("Absolute path to the project directory"),
      filePattern: z.string().optional().describe("Optional file name pattern to filter. Example: '*.ts' for TypeScript files only"),
    }),
  }
);

// ─────────────────────────────────────────────
// Tool 5: list_tree
// ─────────────────────────────────────────────

export const listTreeTool = tool(
  async ({ projectPath, dirPath, maxDepth }) => {
    try {
      const baseDir = dirPath
        ? validatePath(projectPath, dirPath)
        : resolve(projectPath);
      const lines: string[] = [];

      async function buildTree(dir: string, prefix: string, depth: number): Promise<void> {
        if (depth > (maxDepth ?? 4) || lines.length > 200) return;

        let entries: string[];
        try {
          entries = await readdir(dir);
        } catch {
          return;
        }

        // Sort: directories first, then files
        const items: Array<{ name: string; isDir: boolean }> = [];
        for (const entry of entries) {
          if (IGNORED.has(entry)) continue;
          try {
            const s = await stat(join(dir, entry));
            items.push({ name: entry, isDir: s.isDirectory() });
          } catch {
            // skip
          }
        }
        items.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
          const isLast = i === items.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const icon = item.isDir ? "📁 " : "📄 ";
          lines.push(`${prefix}${connector}${icon}${item.name}`);

          if (item.isDir) {
            const nextPrefix = prefix + (isLast ? "    " : "│   ");
            await buildTree(join(dir, item.name), nextPrefix, depth + 1);
          }
        }
      }

      const displayPath = dirPath ?? ".";
      lines.push(`📦 ${displayPath}/`);
      await buildTree(baseDir, "", 0);

      if (lines.length > 200) {
        lines.push("\n... [tree truncated at 200 entries]");
      }

      return lines.join("\n");
    } catch (error: unknown) {
      return `Error listing tree: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  },
  {
    name: "list_tree",
    description:
      "List the project directory tree structure. Shows files and folders in a tree format (ignores node_modules, .git, etc). Use this to understand the project layout.",
    schema: z.object({
      projectPath: z.string().describe("Absolute path to the project directory"),
      dirPath: z.string().optional().describe("Subdirectory to list, relative to project root. Omit for the full project tree."),
      maxDepth: z.number().optional().describe("Max depth to traverse. Default is 4."),
    }),
  }
);

// ─────────────────────────────────────────────
// Tool 6: run_command
// ─────────────────────────────────────────────

export const runCommandTool = tool(
  async ({ command, projectPath }) => {
    // Security: validate the command starts with an allowed prefix
    const firstWord = command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!ALLOWED_COMMANDS.includes(firstWord)) {
      return `❌ Command blocked: "${firstWord}" is not in the allowlist. Allowed: ${ALLOWED_COMMANDS.join(", ")}`;
    }

    // Block dangerous patterns
    const dangerous = ["rm -rf", "del /", "format ", "mkfs", "> /dev", "sudo", "chmod 777"];
    for (const pattern of dangerous) {
      if (command.toLowerCase().includes(pattern)) {
        return `❌ Command blocked: contains dangerous pattern "${pattern}"`;
      }
    }

    try {
      const output = execSync(command, {
        cwd: projectPath,
        encoding: "utf-8",
        timeout: 30_000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB output limit
        stdio: ["pipe", "pipe", "pipe"],
      });

      const truncated = output.length > 10_000
        ? output.slice(0, 10_000) + "\n... [output truncated]"
        : output;

      return `✅ Command: ${command}\n\n${truncated || "(no output)"}`;
    } catch (error: unknown) {
      const err = error as { stderr?: string; stdout?: string; status?: number };
      return `❌ Command failed (exit ${err.status ?? "?"}): ${command}\n\n${err.stderr || err.stdout || "unknown error"}`;
    }
  },
  {
    name: "run_command",
    description:
      "Run a shell command in the project directory. Only allowed commands: npm, npx, node, git, tsc, eslint, prettier, vitest, jest. Use this to install packages, run builds, run tests, etc.",
    schema: z.object({
      command: z.string().describe("The shell command to run. Example: 'npm install express'"),
      projectPath: z.string().describe("Absolute path to the project directory"),
    }),
  }
);

// ─────────────────────────────────────────────
// Export all tools as an array
// ─────────────────────────────────────────────

export const allCodeTools = [
  readFileTool,
  writeFileTool,
  editFileTool,
  searchCodeTool,
  listTreeTool,
  runCommandTool,
];
