import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * Helmet plugin — sets essential HTTP security headers.
 * Protects against XSS, clickjacking, MIME sniffing, etc.
 */
const helmetPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const helmet = await import("@fastify/helmet");
  await app.register(helmet.default, {
    contentSecurityPolicy:
      app.config.NODE_ENV === "production" ? undefined : false,
  });
};

export default fp(helmetPlugin, { name: "helmet" });
