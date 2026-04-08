/**
 * MCP Server connection configuration.
 *
 * Defines the registry of MCP servers the client can connect to.
 * Each entry specifies the transport type and connection details.
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
  /** URL for SSE transport. */
  url?: string;
  /** Whether this server is enabled. */
  enabled: boolean;
}

/**
 * Registry of all MCP server connections.
 * Add new servers here to make them available to the agent.
 */
export const mcpServerRegistry: McpServerConfig[] = [
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
  // --- External MCP Servers ---
  // Uncomment and configure as needed:
  // {
  //   name: "github",
  //   transport: "stdio",
  //   command: "npx",
  //   args: ["-y", "@modelcontextprotocol/server-github"],
  //   enabled: false,
  // },
];
