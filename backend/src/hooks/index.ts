/**
 * Hooks — Lifecycle Management System
 *
 * Provides pre and post execution hooks for all tool operations.
 * This is the central orchestrator that ensures:
 *   1. Security validation before any tool runs (PreToolUse)
 *   2. Audit logging and tracking after every tool runs (PostToolUse)
 *
 * Usage:
 *   const hookManager = new HookManager(logger);
 *   const allowed = hookManager.runPreToolHook({ toolName, args, projectPath });
 *   // ... execute tool ...
 *   const result = hookManager.runPostToolHook({ toolName, args, result, durationMs });
 */

import type { FastifyBaseLogger } from "fastify";
import { preToolUseHook, type HookResult } from "./pre-tool-use.js";
import { postToolUseHook, type PostToolResult } from "./post-tool-use.js";

export class HookManager {
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Run pre-tool-use validation.
   * Returns { allowed, reason } — if not allowed, the tool should not execute.
   */
  runPreToolHook(params: {
    toolName: string;
    args: Record<string, unknown>;
    projectPath: string;
  }): HookResult {
    return preToolUseHook({
      ...params,
      logger: this.logger,
    });
  }

  /**
   * Run post-tool-use processing.
   * Returns the (possibly modified) result and file modification info.
   */
  runPostToolHook(params: {
    toolName: string;
    args: Record<string, unknown>;
    result: string;
    durationMs: number;
    projectPath: string;
  }): PostToolResult {
    return postToolUseHook({
      ...params,
      logger: this.logger,
    });
  }
}

export { type HookResult } from "./pre-tool-use.js";
export { type PostToolResult } from "./post-tool-use.js";
