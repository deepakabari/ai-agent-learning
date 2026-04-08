import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * CORS plugin — allows cross-origin requests from the frontend.
 * In production, restrict to your actual frontend domain.
 */
const corsPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const cors = await import("@fastify/cors");
  await app.register(cors.default, {
    origin:
      app.config.NODE_ENV === "production"
        ? ["https://your-frontend-domain.com"]
        : true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  });
};

export default fp(corsPlugin, { name: "cors" });
