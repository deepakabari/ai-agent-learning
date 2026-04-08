// import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { AgentStateType } from "./state.js";
import type { EnvConfig } from "../config/env.js";
import { allCodeTools } from "../tools/code-tools.js";

/**
 * Coding Assistant System Prompt
 *
 * This transforms the LLM into a senior full-stack developer
 * that can read, understand, and write code in any project.
 */
const CODING_SYSTEM_PROMPT = `You are a **Senior Full-Stack Developer AI Assistant** with deep expertise in modern web technologies.

## Your Capabilities
You can help users with ANY coding project by using your tools:
- **read_file**: Read existing source files to understand the codebase
- **write_file**: Create new files or overwrite existing ones
- **edit_file**: Make surgical edits to existing files (find and replace)
- **search_code**: Search for text across all project files (like grep)
- **list_tree**: View the project directory structure
- **run_command**: Run shell commands (npm, git, tsc, etc.)

## How You Work
1. **Understand first**: Always read relevant files and the project structure before making changes
2. **Explain your plan**: Tell the user what you're going to do before doing it
3. **Make changes**: Use your tools to create/modify files
4. **Verify**: Run commands to check your changes compile/work

## Rules
- ALWAYS pass the projectPath parameter to every tool call — it was provided in the context below
- When writing code, follow the project's existing style and conventions
- Use TypeScript if the project uses TypeScript
- Add proper JSDoc comments to public functions
- Keep files under 200 lines when possible — split into modules
- Never delete files without explicit user permission
- When editing, use edit_file for small changes and write_file for large rewrites
- Format code consistently with the project's style

## Response Format
- Use markdown for explanations
- Put code in fenced code blocks with the language identifier
- When you create/modify files, clearly state which files were changed
- Be concise but thorough`;

/**
 * Creates the LLM with coding tools bound.
 * Supports Groq (Llama 3.3) or Google Gemini.
 */
export function createCodingLLM(config: EnvConfig) {
  // --- Option 1: Groq (Llama 3.3 via OpenAI SDK) ---
  const llm = new ChatOpenAI({
    modelName: config.GROQ_MODEL,
    apiKey: config.GROQ_API_KEY,
    configuration: {
      baseURL: "https://api.groq.com/openai/v1",
    },
    temperature: 0.3,
  });

  // --- Option 2: Google Gemini (Commented out) ---
  /*
  const llm = new ChatGoogleGenerativeAI({
    model: config.GEMINI_MODEL,
    apiKey: config.GOOGLE_API_KEY,
    temperature: 0.3,
    maxOutputTokens: 8192,
  });
  */

  // Bind all code tools so the LLM can call them
  return llm.bindTools(allCodeTools);
}

/**
 * Build the system prompt with project context injected.
 */
function buildSystemPrompt(projectContext: string, projectPath: string): string {
  if (!projectContext) {
    return `${CODING_SYSTEM_PROMPT}\n\n## Current Project\nNo project loaded. Ask the user to set a project path first.`;
  }

  return `${CODING_SYSTEM_PROMPT}\n\n## Current Project (projectPath: "${projectPath}")\n${projectContext}`;
}

/**
 * Agent Node — the LLM that reasons and decides tool calls.
 *
 * This is the "brain" of the coding assistant.
 * It reads the conversation + project context, and either:
 *   a) Responds with a message (no tools) → go to END
 *   b) Requests tool calls → go to tool_executor
 */
export function createAgentNode(config: EnvConfig) {
  const llm = createCodingLLM(config);

  return async (state: AgentStateType) => {
    const systemPrompt = buildSystemPrompt(state.projectContext, state.projectPath);

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      ...state.messages,
    ]);

    return { messages: [response] };
  };
}

/**
 * Tool Executor Node — runs tool calls requested by the agent.
 *
 * Uses LangGraph's built-in ToolNode which:
 *   1. Extracts tool_calls from the last AI message
 *   2. Executes each tool
 *   3. Returns ToolMessage results back to the conversation
 */
export function createToolExecutorNode() {
  return new ToolNode(allCodeTools);
}

/**
 * Response Extractor — pulls the final text response from the agent.
 *
 * Runs after the agent decides NOT to call any more tools.
 * Extracts the text content from the last AI message.
 */
export function createResponseExtractor() {
  return async (state: AgentStateType) => {
    const lastMessage = state.messages[state.messages.length - 1];
    let responseText = "";

    if (lastMessage && "content" in lastMessage) {
      responseText =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);
    }

    // Extract tool names that were used
    const toolNames: string[] = [];
    const filesMod: string[] = [];
    for (const msg of state.messages) {
      if ("name" in msg && typeof msg.name === "string") {
        if (!toolNames.includes(msg.name)) {
          toolNames.push(msg.name);
        }
        // Track file modifications
        if (
          (msg.name === "write_file" || msg.name === "edit_file") &&
          typeof msg.content === "string" &&
          msg.content.startsWith("✅")
        ) {
          const match = msg.content.match(/(?:wrote|edited)\s+(\S+)/);
          if (match?.[1]) filesMod.push(match[1]);
        }
      }
    }

    return {
      finalResponse: responseText,
      toolsUsed: toolNames,
      filesModified: filesMod,
    };
  };
}
