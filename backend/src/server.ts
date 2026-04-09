import { buildApp } from "./app.js";
import { mcpManager } from "./mcp-client/client.js";

/**
 * Application Entry Point
 *
 * Handles:
 *   1. Fastify app initialization
 *   2. MCP server connections
 *   3. Graceful shutdown (SIGTERM/SIGINT)
 */
async function start(): Promise<void> {
  const app = await buildApp();

  // --- Connect to MCP Servers ---
  try {
    await mcpManager.connectAll();
    const { tools, resources, prompts } = await mcpManager.discoverAll();
    app.log.info(
      {
        servers: mcpManager.getConnectedServers(),
        toolCount: tools.length,
        resourceCount: resources.length,
        promptCount: prompts.length,
      },
      "MCP capabilities discovered"
    );
  } catch (error) {
    app.log.warn(
      error,
      "MCP server connection failed — agent will run without MCP capabilities"
    );
  }

  // --- Start Listening ---
  const port = app.config.PORT;
  const host = app.config.HOST;

  await app.listen({ port, host });
  app.log.info(`🚀 AI Agent Backend running at http://${host}:${port}`);

  // --- Graceful Shutdown ---
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal} — shutting down gracefully...`);

    // Close Fastify (stops accepting new requests, drains existing)
    await app.close();

    // Disconnect MCP servers
    await mcpManager.disconnectAll();

    app.log.info("Shutdown complete.");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
