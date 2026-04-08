import type { FastifyBaseLogger } from "fastify";

/**
 * PostToolUse Hook — Audit Logging & Tracking
 *
 * Runs after every tool execution.
 * Responsibilities:
 *   1. Log all tool executions for audit trail
 *   2. Track file modifications
 *   3. Sanitize/truncate tool results if needed
 *   4. Emit metrics (placeholder for production)
 */

export interface PostToolContext {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  durationMs: number;
  projectPath: string;
  logger: FastifyBaseLogger;
}

export interface PostToolResult {
  /** Optionally modified result (e.g., truncated). */
  result: string;
  /** File that was modified (for write/edit tools). */
  fileModified?: string;
}

/**
 * Execute the post-tool-use hook.
 */
export function postToolUseHook(context: PostToolContext): PostToolResult {
  const { toolName, args, result, durationMs, logger } = context;

  // --- 1. Audit Log ---
  logger.info(
    {
      tool: toolName,
      args: sanitizeArgs(args),
      durationMs,
      resultLength: result.length,
      success: !result.startsWith("Error") && !result.startsWith("❌"),
    },
    `Tool executed: ${toolName}`
  );

  // --- 2. Track file modifications ---
  let fileModified: string | undefined;
  if (toolName === "write_file" || toolName === "edit_file") {
    const filePath = String(args["filePath"] ?? "");
    if (result.startsWith("✅")) {
      fileModified = filePath;
      logger.info({ file: filePath, tool: toolName }, "File modified by agent");
    }
  }

  // --- 3. Truncate excessively long results ---
  let finalResult = result;
  const MAX_RESULT_LENGTH = 50_000;
  if (result.length > MAX_RESULT_LENGTH) {
    finalResult = result.slice(0, MAX_RESULT_LENGTH) + "\n\n... [result truncated for performance]";
    logger.warn({ toolName, originalLength: result.length }, "Tool result truncated");
  }

  // --- 4. Log slow operations ---
  if (durationMs > 10_000) {
    logger.warn({ toolName, durationMs }, "Slow tool execution detected");
  }

  return { result: finalResult, fileModified };
}

/**
 * Sanitize tool arguments for logging.
 * Avoids logging full file contents in write_file calls.
 */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...args };

  // Truncate content field (from write_file)
  if (typeof sanitized["content"] === "string") {
    const content = sanitized["content"] as string;
    sanitized["content"] = content.length > 200
      ? `${content.slice(0, 200)}... [${content.length} chars]`
      : content;
  }

  return sanitized;
}
