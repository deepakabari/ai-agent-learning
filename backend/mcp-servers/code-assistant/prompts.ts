import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Code Assistant MCP Server — Prompt Templates
 *
 * MCP Prompts are reusable, parameterized message templates that clients
 * can discover and use to structure LLM interactions. Think of them as
 * "slash commands" that a client can present to the user.
 *
 * Prompts registered:
 *   1. code-review    — Review code for bugs, style, and best practices
 *   2. refactor       — Suggest refactoring improvements
 *   3. explain-code   — Explain what code does in plain English
 *   4. debug-error    — Debug an error message with context
 *   5. generate-tests — Generate unit tests for a given module
 *   6. document-code  — Add JSDoc/TSDoc comments to code
 */

/**
 * Register all prompt templates on the MCP server.
 */
export function registerPrompts(server: McpServer): void {
  // ─────────────────────────────────────────────
  // Prompt 1: Code Review
  // ─────────────────────────────────────────────

  server.prompt(
    "code-review",
    "Review code for bugs, performance issues, security vulnerabilities, and adherence to best practices.",
    {
      code: z.string().describe("The code to review"),
      language: z.string().optional().describe("Programming language (e.g., TypeScript, Python)"),
      focus: z.string().optional().describe("Specific area to focus on — e.g., 'security', 'performance', 'style'"),
    },
    async ({ code, language, focus }) => {
      const focusInstruction = focus
        ? `\nPay special attention to: **${focus}**`
        : "";
      const langContext = language
        ? ` The code is written in ${language}.`
        : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Please review the following code for bugs, performance issues, security vulnerabilities, and best practices.${langContext}${focusInstruction}

\`\`\`${language ?? ""}
${code}
\`\`\`

Provide your review in the following format:
1. **Critical Issues** — Bugs or security problems that must be fixed
2. **Warnings** — Performance or style issues to consider
3. **Suggestions** — Nice-to-have improvements
4. **What's Good** — Well-written patterns worth keeping`,
            },
          },
        ],
      };
    }
  );

  // ─────────────────────────────────────────────
  // Prompt 2: Refactor
  // ─────────────────────────────────────────────

  server.prompt(
    "refactor",
    "Suggest refactoring improvements for cleaner, more maintainable code.",
    {
      code: z.string().describe("The code to refactor"),
      goal: z.string().optional().describe("Refactoring goal — e.g., 'reduce complexity', 'extract functions', 'add types'"),
    },
    async ({ code, goal }) => {
      const goalInstruction = goal
        ? `\nRefactoring goal: **${goal}**`
        : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Please refactor the following code to be cleaner, more readable, and more maintainable.${goalInstruction}

\`\`\`
${code}
\`\`\`

For each change:
1. Explain **why** the refactor improves the code
2. Show the **before** and **after** code
3. Note any **behavioral changes** (there should ideally be none)`,
            },
          },
        ],
      };
    }
  );

  // ─────────────────────────────────────────────
  // Prompt 3: Explain Code
  // ─────────────────────────────────────────────

  server.prompt(
    "explain-code",
    "Explain what a piece of code does in plain English, suitable for different experience levels.",
    {
      code: z.string().describe("The code to explain"),
      level: z.enum(["beginner", "intermediate", "expert"]).optional()
        .describe("Explanation depth — beginner, intermediate, or expert"),
    },
    async ({ code, level }) => {
      const levelMap: Record<string, string> = {
        beginner: "Explain like I'm new to programming. Use analogies and avoid jargon.",
        intermediate: "Explain with technical terms but clarify complex patterns.",
        expert: "Be concise and technical. Focus on design patterns, complexity, and edge cases.",
      };
      const instruction = levelMap[level ?? "intermediate"] ?? levelMap["intermediate"];

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `${instruction}

Please explain the following code:

\`\`\`
${code}
\`\`\`

Structure your explanation:
1. **Overview** — What does this code do at a high level?
2. **Step-by-step** — Walk through the logic
3. **Key Concepts** — Important patterns or techniques used
4. **Gotchas** — Potential issues or non-obvious behavior`,
            },
          },
        ],
      };
    }
  );

  // ─────────────────────────────────────────────
  // Prompt 4: Debug Error
  // ─────────────────────────────────────────────

  server.prompt(
    "debug-error",
    "Debug an error message with relevant code context to find the root cause and fix.",
    {
      error: z.string().describe("The error message or stack trace"),
      code: z.string().optional().describe("The relevant code where the error occurs"),
      context: z.string().optional().describe("Additional context — what you were trying to do"),
    },
    async ({ error, code, context }) => {
      const codePart = code
        ? `\n\nRelevant code:\n\`\`\`\n${code}\n\`\`\``
        : "";
      const contextPart = context
        ? `\n\nContext: ${context}`
        : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I encountered this error and need help debugging it.

**Error:**
\`\`\`
${error}
\`\`\`${codePart}${contextPart}

Please provide:
1. **Root Cause** — What's causing this error?
2. **Fix** — How to resolve it (with code)
3. **Prevention** — How to avoid this in the future
4. **Related Issues** — Other things to check`,
            },
          },
        ],
      };
    }
  );

  // ─────────────────────────────────────────────
  // Prompt 5: Generate Tests
  // ─────────────────────────────────────────────

  server.prompt(
    "generate-tests",
    "Generate comprehensive unit tests for a given code module.",
    {
      code: z.string().describe("The code to generate tests for"),
      framework: z.string().optional().describe("Test framework — e.g., 'vitest', 'jest', 'mocha'"),
      style: z.enum(["unit", "integration", "e2e"]).optional()
        .describe("Type of tests to generate"),
    },
    async ({ code, framework, style }) => {
      const fw = framework ?? "vitest";
      const testStyle = style ?? "unit";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Generate comprehensive ${testStyle} tests for the following code using **${fw}**.

\`\`\`
${code}
\`\`\`

Requirements:
1. Cover **happy paths**, **edge cases**, and **error cases**
2. Use descriptive test names that explain the scenario
3. Use proper setup/teardown if needed
4. Mock external dependencies
5. Include at least 5 meaningful test cases
6. Follow the AAA pattern (Arrange, Act, Assert)`,
            },
          },
        ],
      };
    }
  );

  // ─────────────────────────────────────────────
  // Prompt 6: Document Code
  // ─────────────────────────────────────────────

  server.prompt(
    "document-code",
    "Add JSDoc/TSDoc documentation comments to all public functions and interfaces.",
    {
      code: z.string().describe("The code to add documentation to"),
      style: z.enum(["jsdoc", "tsdoc", "markdown"]).optional()
        .describe("Documentation style — jsdoc, tsdoc, or inline markdown"),
    },
    async ({ code, style }) => {
      const docStyle = style ?? "tsdoc";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Add comprehensive ${docStyle} documentation to the following code.

\`\`\`
${code}
\`\`\`

Requirements:
1. Document all exported functions, classes, and interfaces
2. Include **@param**, **@returns**, and **@throws** tags
3. Add usage **@example** blocks where helpful
4. Keep descriptions concise but informative
5. Return the complete code with documentation added`,
            },
          },
        ],
      };
    }
  );
}
