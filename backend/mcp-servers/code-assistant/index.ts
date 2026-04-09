import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { codeAssistantTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

/**
 * Code Assistant MCP Server
 *
 * A powerful MCP server that provides:
 *   - **Tools**: read_file, write_file, edit_file, search_code, list_tree, run_command
 *   - **Resources**: project://config, project://tree, project://file/{path}
 *   - **Prompts**: code-review, refactor, explain-code, debug-error, generate-tests, document-code
 *
 * Supports two transport modes:
 *   - **stdio**: Local process communication (default)
 *   - **sse**: HTTP Server-Sent Events for remote clients
 *
 * Usage:
 *   stdio:  node --import tsx index.ts
 *   sse:    node --import tsx index.ts --sse --port 3002
 */

const PROJECT_PATH = process.env["PROJECT_PATH"] ?? process.cwd();

const server = new McpServer({
  name: "code-assistant",
  version: "2.0.0",
});

// ─────────────────────────────────────────────
// Register Tools (with annotations)
// ─────────────────────────────────────────────

for (const tool of codeAssistantTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.schema,
    tool.annotations,
    tool.handler
  );
}

// ─────────────────────────────────────────────
// Register Resources
// ─────────────────────────────────────────────

registerResources(server, PROJECT_PATH);

// ─────────────────────────────────────────────
// Register Prompts
// ─────────────────────────────────────────────

registerPrompts(server);

// ─────────────────────────────────────────────
// Transport Selection: stdio (default) or SSE
// ─────────────────────────────────────────────

const args = process.argv.slice(2);
const useSSE = args.includes("--sse");

if (useSSE) {
  // ===============================================
  // SSE Transport — HTTP server for remote clients
  // ===============================================
  const portArg = args[args.indexOf("--port") + 1];
  const port = portArg ? parseInt(portArg, 10) : 3002;

  // Track active SSE transports for cleanup
  const activeTransports = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // CORS headers for browser-based clients
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        server: "code-assistant",
        version: "2.0.0",
        transport: "sse",
        activeConnections: activeTransports.size,
      }));
      return;
    }

    // SSE endpoint — client connects here to receive events
    if (url.pathname === "/sse" && req.method === "GET") {
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;
      activeTransports.set(sessionId, transport);

      // Clean up on disconnect
      res.on("close", () => {
        activeTransports.delete(sessionId);
        console.log(`[SSE] Client disconnected: ${sessionId}`);
      });

      console.log(`[SSE] Client connected: ${sessionId}`);
      await server.connect(transport);
      return;
    }

    // Message endpoint — client sends messages here
    if (url.pathname === "/messages" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing sessionId query parameter" }));
        return;
      }

      const transport = activeTransports.get(sessionId);
      if (!transport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      await transport.handlePostMessage(req, res);
      return;
    }

    // 404 for anything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(port, () => {
    console.log(`[MCP] Code Assistant SSE server running at http://localhost:${port}`);
    console.log(`[MCP] SSE endpoint: http://localhost:${port}/sse`);
    console.log(`[MCP] Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[MCP] Shutting down SSE server...");
    httpServer.close();
    process.exit(0);
  });
} else {
  // ===============================================
  // stdio Transport — local process communication
  // ===============================================
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
