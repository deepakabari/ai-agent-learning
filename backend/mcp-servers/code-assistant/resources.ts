import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Code Assistant MCP Server — Resource Definitions
 *
 * MCP Resources expose readable data to clients. Unlike tools (which DO things),
 * resources LET clients READ things. They appear as URIs the client can fetch.
 *
 * Resources registered:
 *   1. project://config    — package.json contents (name, scripts, deps)
 *   2. project://tree      — Directory tree structure
 *   3. project://file/{path} — Read any project file by path (resource template)
 */

const IGNORED = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  "coverage", ".cache", "__pycache__", ".DS_Store",
]);

/**
 * Register all resources on the MCP server.
 *
 * @param server - The McpServer instance to register resources on.
 * @param projectPath - The root directory of the project to expose.
 */
export function registerResources(server: McpServer, projectPath: string): void {
  // ─────────────────────────────────────────────
  // Resource 1: Project Configuration
  // ─────────────────────────────────────────────

  server.resource(
    "project-config",
    "project://config",
    {
      description: "Project configuration — package.json contents including name, version, scripts, and dependencies.",
      mimeType: "application/json",
    },
    async () => {
      try {
        const pkgPath = resolve(projectPath, "package.json");
        const raw = await readFile(pkgPath, "utf-8");
        const pkg = JSON.parse(raw) as Record<string, unknown>;

        // Return a curated view (not the entire package.json)
        const config = {
          name: pkg["name"],
          version: pkg["version"],
          description: pkg["description"],
          scripts: pkg["scripts"],
          dependencies: Object.keys((pkg["dependencies"] as Record<string, string>) ?? {}),
          devDependencies: Object.keys((pkg["devDependencies"] as Record<string, string>) ?? {}),
          engines: pkg["engines"],
          type: pkg["type"],
        };

        return {
          contents: [
            {
              uri: "project://config",
              mimeType: "application/json",
              text: JSON.stringify(config, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: "project://config",
              mimeType: "text/plain",
              text: `Error reading project config: ${error instanceof Error ? error.message : "unknown"}`,
            },
          ],
        };
      }
    }
  );

  // ─────────────────────────────────────────────
  // Resource 2: Project Directory Tree
  // ─────────────────────────────────────────────

  server.resource(
    "project-tree",
    "project://tree",
    {
      description: "Project directory tree structure — shows all files and folders (excluding node_modules, .git, etc).",
      mimeType: "text/plain",
    },
    async () => {
      const lines: string[] = [];

      async function buildTree(dir: string, prefix: string, depth: number): Promise<void> {
        if (depth > 4 || lines.length > 300) return;
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
          } catch {
            /* skip */
          }
        }
        items.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));

        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
          const isLast = i === items.length - 1;
          lines.push(`${prefix}${isLast ? "└── " : "├── "}${item.name}${item.isDir ? "/" : ""}`);
          if (item.isDir) {
            await buildTree(join(dir, item.name), prefix + (isLast ? "    " : "│   "), depth + 1);
          }
        }
      }

      lines.push(`📦 ${resolve(projectPath)}`);
      await buildTree(resolve(projectPath), "", 0);

      return {
        contents: [
          {
            uri: "project://tree",
            mimeType: "text/plain",
            text: lines.join("\n"),
          },
        ],
      };
    }
  );

  // ─────────────────────────────────────────────
  // Resource Template 3: Read any file by path
  // ─────────────────────────────────────────────

  server.resource(
    "project-file",
    "project://file/{filePath}",
    {
      description: "Read any project file by its relative path. Returns the file contents with line numbers.",
      mimeType: "text/plain",
    },
    async (uri) => {
      // Extract filePath from the URI (project://file/{filePath})
      const filePath = decodeURIComponent(uri.pathname.replace(/^\/file\//, "") || uri.href.replace(/^project:\/\/file\//, ""));

      try {
        const safePath = resolve(projectPath, filePath);
        if (!safePath.startsWith(resolve(projectPath))) {
          throw new Error("Access denied: path traversal detected.");
        }

        const content = await readFile(safePath, "utf-8");
        const ext = extname(filePath).toLowerCase();

        // Determine MIME type
        const mimeMap: Record<string, string> = {
          ".ts": "text/typescript",
          ".tsx": "text/typescript",
          ".js": "application/javascript",
          ".jsx": "application/javascript",
          ".json": "application/json",
          ".md": "text/markdown",
          ".css": "text/css",
          ".html": "text/html",
          ".yml": "text/yaml",
          ".yaml": "text/yaml",
        };
        const mimeType = mimeMap[ext] ?? "text/plain";

        // Add line numbers for text files
        const numbered = content
          .split("\n")
          .map((line, i) => `${i + 1}: ${line}`)
          .join("\n");

        return {
          contents: [
            {
              uri: uri.href,
              mimeType,
              text: numbered,
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error reading ${filePath}: ${error instanceof Error ? error.message : "unknown"}`,
            },
          ],
        };
      }
    }
  );
}
