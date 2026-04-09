import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerEnv } from "./config/env.js";
import corsPlugin from "./plugins/cors.js";
import helmetPlugin from "./plugins/helmet.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import healthRoutes from "./routes/health.js";
import agentRoutes from "./routes/agent.js";
import projectRoutes from "./routes/project.js";
import mcpRoutes from "./routes/mcp.js";

/**
 * Build and configure the Fastify application.
 *
 * Uses the encapsulated plugin pattern:
 *   1. Environment validation (fail-fast)
 *   2. Security plugins (Helmet, CORS, Rate Limit)
 *   3. Route registration
 *
 * @returns Configured Fastify instance (not yet listening).
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
      transport:
        process.env["NODE_ENV"] !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    requestTimeout: 120_000, // 2 min — LLM tool loops can take time
    bodyLimit: 1_048_576, // 1 MB
  });

  // --- Phase 1: Environment ---
  await registerEnv(app);

  // --- Phase 2: Security Plugins ---
  await app.register(helmetPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);

  // --- Phase 3: Routes ---
  await app.register(healthRoutes); // Internal ALB Health Checks (/healthz)
  await app.register(healthRoutes, { prefix: "/api" }); // Public Health Checks (/api/healthz)
  await app.register(agentRoutes, { prefix: "/api" });
  await app.register(projectRoutes, { prefix: "/api" });
  await app.register(mcpRoutes, { prefix: "/api" });

  // --- Global Error Handler ---
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: error.name,
      message:
        statusCode >= 500
          ? "Internal Server Error"
          : error.message,
      statusCode,
    });
  });

  return app;
}
