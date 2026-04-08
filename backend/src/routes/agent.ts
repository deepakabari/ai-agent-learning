import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { invokeAgent } from "../agent/graph.js";
import { ensureLocalPath } from "../services/repo-manager.js";

/**
 * Agent routes — the primary API for the coding assistant.
 */
const agentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/agent/invoke (prefixed by app.ts)
   * Accepts a user message, optional project path, and session ID.
   * Returns the agent's response after full LangGraph execution.
   */
  app.post<{
    Body: { message: string; projectPath?: string; sessionId?: string };
  }>("/agent/invoke", {
    schema: {
      body: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string", minLength: 1, maxLength: 10_000 },
          projectPath: { type: "string" },
          sessionId: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            response: { type: "string" },
            toolsUsed: { type: "array", items: { type: "string" } },
            filesModified: { type: "array", items: { type: "string" } },
            projectInfo: {
              type: "object",
              properties: {
                name: { type: "string" },
                techStack: { type: "array", items: { type: "string" } },
                fileCount: { type: "number" },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { message, projectPath, sessionId } = request.body;

      try {
        const localPath = projectPath ? await ensureLocalPath(projectPath) : undefined;
        const result = await invokeAgent({
          message,
          projectPath: localPath,
          sessionId,
          config: app.config,
          logger: app.log,
        });

        return reply.send(result);
      } catch (error) {
        app.log.error(error, "Agent invocation failed");
        return reply.status(500).send({
          error: "Agent invocation failed",
          message:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  });
};

export default agentRoutes;
