import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

/**
 * AgentState — the shared state flowing through the LangGraph.
 *
 * Enhanced for the coding assistant with project context,
 * file tracking, and tool-calling loop support.
 */
export const AgentState = Annotation.Root({
  /** The conversation message history (includes tool calls & results). */
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  /** The current session ID for conversation persistence. */
  sessionId: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => crypto.randomUUID(),
  }),

  /** Absolute path to the user's project directory. */
  projectPath: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),

  /** Auto-generated project context summary (injected into system prompt). */
  projectContext: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),

  /** Names of tools that were invoked during this execution. */
  toolsUsed: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  /** Files that were created or modified during this execution. */
  filesModified: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  /** The final response text to return to the user. */
  finalResponse: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
});

/** Inferred TypeScript type for the agent state. */
export type AgentStateType = typeof AgentState.State;
