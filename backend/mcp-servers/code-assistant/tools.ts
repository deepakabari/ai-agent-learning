import { z } from "zod";
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { resolve, join, relative, extname } from "node:path";
import { execSync } from "node:child_process";

/**
 * Code Assistant MCP Server — Tool Definitions
 *
 * These are the same 6 tools as in src/tools/code-tools.ts
 * but exposed via MCP protocol for external clients.
 *
 * The projectPath comes from the tool arguments since MCP clients
 * connect externally and need to specify the target.
 */

const IGNORED = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  "coverage", ".cache", "__pycache__", ".DS_Store",
]);

const ALLOWED_COMMANDS = [
  "npm", "npx", "node", "git", "tsc", "eslint", "prettier",
  "vitest", "jest", "cat", "echo", "ls", "dir", "type",
];

function validatePath(projectPath: string, filePath: string): string {
  const resolved = resolve(projectPath, filePath);
  if (!resolved.startsWith(resolve(projectPath))) {
    throw new Error("Access denied: path traversal detected.");
  }
  return resolved;
}

interface McpToolDef {
  name: string;
  description: string;
  schema: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
}

export const codeAssistantTools: McpToolDef[] = [
  {
    name: "read_file",
    description: "Read a file's contents with line numbers.",
    schema: {
      filePath: z.string().describe("Relative path to the file"),
      projectPath: z.string().describe("Absolute project directory"),
    },
    handler: async (args) => {
      const safePath = validatePath(String(args["projectPath"]), String(args["filePath"]));
      const content = await readFile(safePath, "utf-8");
      const numbered = content.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
      return { content: [{ type: "text" as const, text: numbered }] };
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file with the given content.",
    schema: {
      filePath: z.string(),
      content: z.string(),
      projectPath: z.string(),
    },
    handler: async (args) => {
      const safePath = validatePath(String(args["projectPath"]), String(args["filePath"]));
      await mkdir(resolve(safePath, ".."), { recursive: true });
      await writeFile(safePath, String(args["content"]), "utf-8");
      return { content: [{ type: "text" as const, text: `✅ Wrote ${args["filePath"]}` }] };
    },
  },
  {
    name: "edit_file",
    description: "Find and replace text in a file.",
    schema: {
      filePath: z.string(),
      searchText: z.string(),
      replaceText: z.string(),
      projectPath: z.string(),
    },
    handler: async (args) => {
      const safePath = validatePath(String(args["projectPath"]), String(args["filePath"]));
      const content = await readFile(safePath, "utf-8");
      const search = String(args["searchText"]);
      if (!content.includes(search)) {
        return { content: [{ type: "text" as const, text: "Error: search text not found." }] };
      }
      await writeFile(safePath, content.replace(search, String(args["replaceText"])), "utf-8");
      return { content: [{ type: "text" as const, text: `✅ Edited ${args["filePath"]}` }] };
    },
  },
  {
    name: "search_code",
    description: "Search for text across all project files.",
    schema: {
      query: z.string(),
      projectPath: z.string(),
    },
    handler: async (args) => {
      const results: string[] = [];
      const dir = resolve(String(args["projectPath"]));
      const query = String(args["query"]);

      async function search(d: string, depth: number): Promise<void> {
        if (depth > 5 || results.length > 30) return;
        const entries = await readdir(d);
        for (const entry of entries) {
          if (IGNORED.has(entry)) continue;
          const full = join(d, entry);
          const s = await stat(full);
          if (s.isDirectory()) {
            await search(full, depth + 1);
          } else {
            const ext = extname(entry).toLowerCase();
            const textExts = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html"];
            if (!textExts.includes(ext)) continue;
            const content = await readFile(full, "utf-8");
            content.split("\n").forEach((line, i) => {
              if (line.includes(query) && results.length < 30) {
                results.push(`${relative(dir, full)}:${i + 1}: ${line.trim()}`);
              }
            });
          }
        }
      }

      await search(dir, 0);
      const text = results.length ? results.join("\n") : `No results for "${query}"`;
      return { content: [{ type: "text" as const, text }] };
    },
  },
  {
    name: "list_tree",
    description: "List the project directory tree.",
    schema: {
      projectPath: z.string(),
      maxDepth: z.number().optional(),
    },
    handler: async (args) => {
      const lines: string[] = [];
      const dir = resolve(String(args["projectPath"]));
      const max = Number(args["maxDepth"] ?? 4);

      async function tree(d: string, prefix: string, depth: number): Promise<void> {
        if (depth > max || lines.length > 200) return;
        let entries: string[];
        try { entries = await readdir(d); } catch { return; }
        const items: Array<{ name: string; isDir: boolean }> = [];
        for (const e of entries) {
          if (IGNORED.has(e)) continue;
          try {
            const s = await stat(join(d, e));
            items.push({ name: e, isDir: s.isDirectory() });
          } catch { /* skip */ }
        }
        items.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
        for (let i = 0; i < items.length; i++) {
          const it = items[i]!;
          const last = i === items.length - 1;
          lines.push(`${prefix}${last ? "└── " : "├── "}${it.name}${it.isDir ? "/" : ""}`);
          if (it.isDir) await tree(join(d, it.name), prefix + (last ? "    " : "│   "), depth + 1);
        }
      }

      await tree(dir, "", 0);
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  },
  {
    name: "run_command",
    description: "Run a shell command in the project directory. Only safe commands allowed.",
    schema: {
      command: z.string(),
      projectPath: z.string(),
    },
    handler: async (args) => {
      const command = String(args["command"]);
      const first = command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      if (!ALLOWED_COMMANDS.includes(first)) {
        return { content: [{ type: "text" as const, text: `❌ Blocked: "${first}" not allowed.` }] };
      }
      try {
        const output = execSync(command, {
          cwd: String(args["projectPath"]),
          encoding: "utf-8",
          timeout: 30_000,
        });
        return { content: [{ type: "text" as const, text: output || "(no output)" }] };
      } catch (error: unknown) {
        const err = error as { stderr?: string };
        return { content: [{ type: "text" as const, text: `❌ ${err.stderr ?? "Command failed"}` }] };
      }
    },
  },
];
