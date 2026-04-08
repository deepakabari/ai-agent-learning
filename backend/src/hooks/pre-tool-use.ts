import type { FastifyBaseLogger } from "fastify";

/**
 * PreToolUse Hook — Security Gate
 *
 * Validates tool calls before execution.
 * Enhanced for the coding assistant with:
 *   - Path traversal detection
 *   - Command allowlist enforcement
 *   - Dangerous operation blocking
 *   - File extension blocking (.env, .pem, etc)
 */

/** File extensions that should never be written to. */
const BLOCKED_WRITE_EXTENSIONS = [
  ".env", ".pem", ".key", ".cert", ".crt",
  ".p12", ".pfx", ".jks",
];

/** Patterns that indicate dangerous file operations. */
const DANGEROUS_PATH_PATTERNS = [
  /\.\.\//,                   // path traversal
  /^[A-Z]:\\/i,               // absolute Windows paths (must use relative)
  /^\/etc\//,                 // Linux system directories
  /^\/usr\//,
  /^\/var\//,
  /node_modules\//,           // never write into node_modules
];

/** Commands blocked even if the base command is allowed. */
const BLOCKED_COMMAND_PATTERNS = [
  "rm -rf",
  "del /s",
  "format ",
  "mkfs",
  "> /dev",
  "sudo ",
  "chmod 777",
  "curl ",     // no network requests
  "wget ",
  "ssh ",
  "scp ",
];

export interface HookContext {
  toolName: string;
  args: Record<string, unknown>;
  projectPath: string;
  logger: FastifyBaseLogger;
}

export interface HookResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Execute the pre-tool-use validation hook.
 *
 * Returns { allowed: true } if the operation is safe,
 * or { allowed: false, reason: "..." } to block it.
 */
export function preToolUseHook(context: HookContext): HookResult {
  const { toolName, args, logger } = context;

  // --- Validate write operations ---
  if (toolName === "write_file" || toolName === "edit_file") {
    const filePath = String(args["filePath"] ?? "");

    // Check for blocked extensions
    for (const ext of BLOCKED_WRITE_EXTENSIONS) {
      if (filePath.endsWith(ext)) {
        logger.warn({ toolName, filePath }, "Blocked write to sensitive file");
        return {
          allowed: false,
          reason: `Cannot write to ${ext} files — these contain sensitive data.`,
        };
      }
    }

    // Check for dangerous path patterns
    for (const pattern of DANGEROUS_PATH_PATTERNS) {
      if (pattern.test(filePath)) {
        logger.warn({ toolName, filePath, pattern: pattern.source }, "Blocked dangerous path");
        return {
          allowed: false,
          reason: `Blocked: file path "${filePath}" matches dangerous pattern.`,
        };
      }
    }
  }

  // --- Validate run_command ---
  if (toolName === "run_command") {
    const command = String(args["command"] ?? "").toLowerCase();

    for (const pattern of BLOCKED_COMMAND_PATTERNS) {
      if (command.includes(pattern)) {
        logger.warn({ toolName, command, pattern }, "Blocked dangerous command");
        return {
          allowed: false,
          reason: `Blocked: command contains dangerous pattern "${pattern}".`,
        };
      }
    }
  }

  // --- Validate read operations stay within project ---
  if (toolName === "read_file" || toolName === "list_tree" || toolName === "search_code") {
    const path = String(args["filePath"] ?? args["dirPath"] ?? "");
    if (path.includes("..")) {
      return {
        allowed: false,
        reason: "Path traversal detected — use paths relative to the project root.",
      };
    }
  }

  return { allowed: true };
}
