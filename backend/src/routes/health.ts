import type { FastifyInstance, FastifyPluginAsync } from "fastify";

/**
 * Health check route — used by ALB, ECS, and Docker health checks.
 * Returns 200 OK with status and uptime information.
 */
const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/healthz", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            uptime: { type: "number" },
            timestamp: { type: "string" },
          },
        },
      },
    },
    handler: async (_request, _reply) => {
      return {
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    },
  });
};

export default healthRoutes;
