import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { mcpManager } from "../mcp-client/client.js";

/**
 * MCP Routes — API endpoints for MCP server management and discovery.
 *
 * Exposes the full MCP capability surface to the frontend:
 *   - GET /api/mcp/status       — Connection status of all MCP servers
 *   - GET /api/mcp/tools        — Discover all available tools
 *   - GET /api/mcp/resources    — Discover all available resources
 *   - GET /api/mcp/prompts      — Discover all available prompt templates
 *   - GET /api/mcp/discover     — Discover everything in one call
 *   - POST /api/mcp/resources/read  — Read a specific resource by URI
 *   - POST /api/mcp/prompts/get     — Get a rendered prompt with arguments
 */
const mcpRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/mcp/status
   * Returns the connection status of all MCP servers.
   */
  app.get("/mcp/status", async (_request, reply) => {
    return reply.send({
      connectedServers: mcpManager.getConnectedServers(),
    });
  });

  /**
   * GET /api/mcp/tools
   * Discover all available tools across all connected MCP servers.
   */
  app.get("/mcp/tools", async (_request, reply) => {
    try {
      const tools = await mcpManager.discoverTools();
      return reply.send({ tools });
    } catch (error) {
      return reply.status(500).send({
        error: "Failed to discover tools",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/mcp/resources
   * Discover all available resources across all connected MCP servers.
   */
  app.get("/mcp/resources", async (_request, reply) => {
    try {
      const resources = await mcpManager.discoverResources();
      return reply.send({ resources });
    } catch (error) {
      return reply.status(500).send({
        error: "Failed to discover resources",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/mcp/prompts
   * Discover all available prompt templates across all connected MCP servers.
   */
  app.get("/mcp/prompts", async (_request, reply) => {
    try {
      const prompts = await mcpManager.discoverPrompts();
      return reply.send({ prompts });
    } catch (error) {
      return reply.status(500).send({
        error: "Failed to discover prompts",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/mcp/discover
   * Discover ALL capabilities (tools + resources + prompts) in one call.
   */
  app.get("/mcp/discover", async (_request, reply) => {
    try {
      const capabilities = await mcpManager.discoverAll();
      return reply.send({
        servers: mcpManager.getConnectedServers(),
        ...capabilities,
      });
    } catch (error) {
      return reply.status(500).send({
        error: "Failed to discover MCP capabilities",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * POST /api/mcp/resources/read
   * Read a specific resource from a connected MCP server.
   */
  app.post<{
    Body: { server: string; uri: string };
  }>("/mcp/resources/read", {
    schema: {
      body: {
        type: "object",
        required: ["server", "uri"],
        properties: {
          server: { type: "string", minLength: 1 },
          uri: { type: "string", minLength: 1 },
        },
      },
    },
    handler: async (request, reply) => {
      const { server, uri } = request.body;

      try {
        const result = await mcpManager.readResource(server, uri);
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({
          error: "Failed to read resource",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  });

  /**
   * POST /api/mcp/prompts/get
   * Get a rendered prompt template with arguments filled in.
   */
  app.post<{
    Body: { server: string; prompt: string; arguments: Record<string, string> };
  }>("/mcp/prompts/get", {
    schema: {
      body: {
        type: "object",
        required: ["server", "prompt"],
        properties: {
          server: { type: "string", minLength: 1 },
          prompt: { type: "string", minLength: 1 },
          arguments: { type: "object", additionalProperties: { type: "string" } },
        },
      },
    },
    handler: async (request, reply) => {
      const { server, prompt, arguments: args } = request.body;

      try {
        const result = await mcpManager.getPrompt(server, prompt, args ?? {});
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({
          error: "Failed to get prompt",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  });
};

export default mcpRoutes;
