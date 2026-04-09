import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { mcpServerRegistry, type McpServerConfig } from "./config.js";

/**
 * Discovered tool metadata from an MCP server.
 */
export interface DiscoveredTool {
  server: string;
  name: string;
  description?: string;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/**
 * Discovered resource metadata from an MCP server.
 */
export interface DiscoveredResource {
  server: string;
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Discovered prompt metadata from an MCP server.
 */
export interface DiscoveredPrompt {
  server: string;
  name: string;
  description?: string;
}

/**
 * MCPClientManager — manages connections to multiple MCP servers.
 *
 * Handles lifecycle (connect, disconnect), and discovery of:
 *   - Tools (functions the AI can call)
 *   - Resources (data the AI can read)
 *   - Prompts (reusable message templates)
 *
 * Supports both stdio (local) and SSE (remote) transports.
 */
export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport | SSEClientTransport> = new Map();

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
   * Supports both stdio and SSE transports.
   */
  private async connect(config: McpServerConfig): Promise<void> {
    let transport: StdioClientTransport | SSEClientTransport;

    if (config.transport === "stdio") {
      if (!config.command) {
        console.warn(`[MCP] Missing command for stdio server "${config.name}". Skipping.`);
        return;
      }
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
    } else if (config.transport === "sse") {
      if (!config.url) {
        console.warn(`[MCP] Missing URL for SSE server "${config.name}". Skipping.`);
        return;
      }
      transport = new SSEClientTransport(new URL(config.url));
    } else {
      console.warn(`[MCP] Unsupported transport "${config.transport}" for "${config.name}". Skipping.`);
      return;
    }

    const client = new Client(
      { name: `ai-agent-client-${config.name}`, version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.clients.set(config.name, client);
    this.transports.set(config.name, transport);

    console.log(`[MCP] Connected to "${config.name}" via ${config.transport}`);
  }

  // ─────────────────────────────────────────────
  // Tool Discovery & Invocation
  // ─────────────────────────────────────────────

  /**
   * Discover all available tools across all connected servers.
   * Returns a flat array of tool definitions with annotations.
   */
  async discoverTools(): Promise<DiscoveredTool[]> {
    const allTools: DiscoveredTool[] = [];

    for (const [serverName, client] of this.clients) {
      try {
        const { tools } = await client.listTools();
        for (const tool of tools) {
          allTools.push({
            server: serverName,
            name: tool.name,
            description: tool.description,
            annotations: tool.annotations,
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

  // ─────────────────────────────────────────────
  // Resource Discovery & Reading
  // ─────────────────────────────────────────────

  /**
   * Discover all available resources across all connected servers.
   * Resources are read-only data endpoints (like project config, file trees).
   */
  async discoverResources(): Promise<DiscoveredResource[]> {
    const allResources: DiscoveredResource[] = [];

    for (const [serverName, client] of this.clients) {
      try {
        const { resources } = await client.listResources();
        for (const resource of resources) {
          allResources.push({
            server: serverName,
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType,
          });
        }
      } catch (error) {
        console.warn(
          `[MCP] Failed to list resources from "${serverName}":`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return allResources;
  }

  /**
   * Read a resource from a specific server by URI.
   *
   * @param serverName - The name of the connected MCP server.
   * @param uri - The resource URI (e.g., "project://config").
   * @returns The resource contents.
   */
  async readResource(
    serverName: string,
    uri: string
  ): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server "${serverName}" is not connected.`);
    }

    const result = await client.readResource({ uri });
    return result;
  }

  // ─────────────────────────────────────────────
  // Prompt Discovery & Retrieval
  // ─────────────────────────────────────────────

  /**
   * Discover all available prompt templates across all connected servers.
   * Prompts are reusable message templates (like slash commands).
   */
  async discoverPrompts(): Promise<DiscoveredPrompt[]> {
    const allPrompts: DiscoveredPrompt[] = [];

    for (const [serverName, client] of this.clients) {
      try {
        const { prompts } = await client.listPrompts();
        for (const prompt of prompts) {
          allPrompts.push({
            server: serverName,
            name: prompt.name,
            description: prompt.description,
          });
        }
      } catch (error) {
        console.warn(
          `[MCP] Failed to list prompts from "${serverName}":`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return allPrompts;
  }

  /**
   * Get a prompt from a specific server with arguments filled in.
   *
   * @param serverName - The name of the connected MCP server.
   * @param promptName - The prompt name (e.g., "code-review").
   * @param args - Arguments to fill into the prompt template.
   * @returns The rendered prompt messages.
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>
  ): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server "${serverName}" is not connected.`);
    }

    const result = await client.getPrompt({ name: promptName, arguments: args });
    return result;
  }

  // ─────────────────────────────────────────────
  // Full Discovery (all capabilities)
  // ─────────────────────────────────────────────

  /**
   * Discover ALL capabilities across all connected servers.
   * Returns tools, resources, and prompts in one call.
   */
  async discoverAll(): Promise<{
    tools: DiscoveredTool[];
    resources: DiscoveredResource[];
    prompts: DiscoveredPrompt[];
  }> {
    const [tools, resources, prompts] = await Promise.all([
      this.discoverTools(),
      this.discoverResources(),
      this.discoverPrompts(),
    ]);

    return { tools, resources, prompts };
  }

  // ─────────────────────────────────────────────
  // Connection Status & Lifecycle
  // ─────────────────────────────────────────────

  /**
   * Get the list of currently connected server names.
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if a specific server is connected.
   */
  isConnected(serverName: string): boolean {
    return this.clients.has(serverName);
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
