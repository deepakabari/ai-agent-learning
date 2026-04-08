import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mcpServerRegistry, type McpServerConfig } from "./config.js";

/**
 * MCPClientManager — manages connections to multiple MCP servers.
 *
 * Handles lifecycle (connect, disconnect), tool discovery,
 * and tool invocation across all registered MCP servers.
 */
export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();

  /**
   * Connect to all enabled MCP servers in the registry.
   * Skips servers that fail to connect (logs warning instead of crashing).
   */
  async connectAll(): Promise<void> {
    const enabledServers = mcpServerRegistry.filter((s) => s.enabled);

    for (const serverConfig of enabledServers) {
      try {
        await this.connect(serverConfig);
      } catch (error) {
        console.warn(
          `[MCP] Failed to connect to "${serverConfig.name}":`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  /**
   * Connect to a single MCP server.
   */
  private async connect(config: McpServerConfig): Promise<void> {
    if (config.transport !== "stdio" || !config.command) {
      console.warn(`[MCP] Only stdio transport is supported. Skipping "${config.name}".`);
      return;
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
    });

    const client = new Client(
      { name: `ai-agent-client-${config.name}`, version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.clients.set(config.name, client);
    this.transports.set(config.name, transport);

    console.log(`[MCP] Connected to "${config.name}"`);
  }

  /**
   * Discover all available tools across all connected servers.
   * Returns a flat array of tool definitions.
   */
  async discoverTools(): Promise<
    Array<{ server: string; name: string; description?: string }>
  > {
    const allTools: Array<{
      server: string;
      name: string;
      description?: string;
    }> = [];

    for (const [serverName, client] of this.clients) {
      try {
        const { tools } = await client.listTools();
        for (const tool of tools) {
          allTools.push({
            server: serverName,
            name: tool.name,
            description: tool.description,
          });
        }
      } catch (error) {
        console.warn(
          `[MCP] Failed to list tools from "${serverName}":`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return allTools;
  }

  /**
   * Invoke a tool on a specific server.
   */
  async invokeTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server "${serverName}" is not connected.`);
    }

    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
  }

  /**
   * Gracefully disconnect from all MCP servers.
   */
  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.close();
        console.log(`[MCP] Disconnected from "${name}"`);
      } catch {
        // Ignore close errors during shutdown
      }
    }
    this.clients.clear();
    this.transports.clear();
  }
}

/** Singleton instance of the MCP client manager. */
export const mcpManager = new MCPClientManager();
