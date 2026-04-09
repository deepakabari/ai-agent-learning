/**
 * MCP Server connection configuration.
 *
 * Defines the registry of MCP servers the client can connect to.
 * Each entry specifies the transport type and connection details.
 *
 * Supports two transports:
 *   - **stdio**: Local process communication (command + args)
 *   - **sse**: Remote HTTP Server-Sent Events (url)
 */

export interface McpServerConfig {
  /** Human-readable name for this server. */
  name: string;
  /** Transport type: stdio for local processes, sse for remote HTTP. */
  transport: "stdio" | "sse";
  /** Command to run for stdio transport. */
  command?: string;
  /** Arguments for the stdio command. */
  args?: string[];
  /** Environment variables to pass to the stdio process. */
  env?: Record<string, string>;
  /** URL for SSE transport (e.g., "http://localhost:3002/sse"). */
  url?: string;
  /** Whether this server is enabled. */
  enabled: boolean;
}

/**
 * Registry of all MCP server connections.
 * Add new servers here to make them available to the agent.
 *
 * Servers are connected in order. Failed connections are skipped
 * with a warning (the agent continues without them).
 */
export const mcpServerRegistry: McpServerConfig[] = [
  // --- Local MCP Servers (stdio) ---
  {
    name: "calculator",
    transport: "stdio",
    command: "node",
    args: ["--import", "tsx", "../mcp-servers/calculator/index.ts"],
    enabled: true,
  },
  {
    name: "file-reader",
    transport: "stdio",
    command: "node",
    args: ["--import", "tsx", "../mcp-servers/file-reader/index.ts"],
    enabled: true,
  },
  {
    name: "code-assistant",
    transport: "stdio",
    command: "node",
    args: ["--import", "tsx", "../mcp-servers/code-assistant/index.ts"],
    env: {
      PROJECT_PATH: process.cwd(),
    },
    enabled: true,
  },

  // --- Remote MCP Servers (SSE) ---
  // Uncomment to connect to the code-assistant via SSE instead of stdio:
  // {
  //   name: "code-assistant-remote",
  //   transport: "sse",
  //   url: "http://localhost:3002/sse",
  //   enabled: false,
  // },

  // --- External MCP Servers ---
  // Uncomment and configure as needed:
  // {
  //   name: "github",
  //   transport: "stdio",
  //   command: "npx",
  //   args: ["-y", "@modelcontextprotocol/server-github"],
  //   env: {
  //     GITHUB_PERSONAL_ACCESS_TOKEN: process.env["GITHUB_TOKEN"] ?? "",
  //   },
  //   enabled: false,
  // },
];
