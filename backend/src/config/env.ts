import type { FastifyInstance } from "fastify";

/**
 * Environment variable schema and validation config.
 * Uses @fastify/env with Ajv JSON Schema validation.
 * App fails fast at startup if required vars are missing.
 */
export const envSchema = {
  type: "object" as const,
  required: ["GOOGLE_API_KEY"],
  properties: {
    PORT: { type: "number", default: 3001 },
    HOST: { type: "string", default: "0.0.0.0" },
    NODE_ENV: {
      type: "string",
      default: "development",
      enum: ["development", "production", "test"],
    },
    GOOGLE_API_KEY: { type: "string" },
    GEMINI_MODEL: { type: "string", default: "gemini-1.5-flash" },
    AWS_REGION: { type: "string", default: "us-east-1" },
    DYNAMODB_TABLE_NAME: {
      type: "string",
      default: "ai-agent-conversations",
    },
    RATE_LIMIT_MAX: { type: "number", default: 100 },
    RATE_LIMIT_WINDOW_MS: { type: "number", default: 60_000 },
  },
};

/** Type-safe environment config derived from the schema. */
export interface EnvConfig {
  PORT: number;
  HOST: string;
  NODE_ENV: "development" | "production" | "test";
  GOOGLE_API_KEY: string;
  GEMINI_MODEL: string;
  AWS_REGION: string;
  DYNAMODB_TABLE_NAME: string;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_WINDOW_MS: number;
}

/** Register the env plugin on a Fastify instance. */
export async function registerEnv(app: FastifyInstance): Promise<void> {
  const fastifyEnv = await import("@fastify/env");
  await app.register(fastifyEnv.default, {
    confKey: "config",
    schema: envSchema,
    dotenv: true,
  });
}

/**
 * Augment Fastify's type definitions to include our config.
 * This allows `app.config.PORT` etc. to be type-safe.
 */
declare module "fastify" {
  interface FastifyInstance {
    config: EnvConfig;
  }
}
