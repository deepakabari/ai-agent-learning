import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { codeAssistantTools } from "./tools.js";

/**
 * Code Assistant MCP Server
 *
 * A powerful MCP server that provides coding tools:
 *   - read_file, write_file, edit_file
 *   - search_code, list_tree, run_command
 *
 * Can be connected to by any MCP-compatible client.
 */
const server = new McpServer({
  name: "code-assistant",
  version: "1.0.0",
});

// Register all coding tools
for (const tool of codeAssistantTools) {
  server.tool(tool.name, tool.description, tool.schema, tool.handler);
}

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
