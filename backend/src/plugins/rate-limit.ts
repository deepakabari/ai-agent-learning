import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * Rate limit plugin — prevents brute-force attacks and API abuse.
 * Configurable via RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_MS env vars.
 */
const rateLimitPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const rateLimit = await import("@fastify/rate-limit");
  await app.register(rateLimit.default, {
    max: app.config.RATE_LIMIT_MAX,
    timeWindow: app.config.RATE_LIMIT_WINDOW_MS,
  });
};

export default fp(rateLimitPlugin, { name: "rate-limit" });
