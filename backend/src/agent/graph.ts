import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentState } from "./state.js";
import type { AgentStateType } from "./state.js";
import {
  createAgentNode,
  createToolExecutorNode,
  createResponseExtractor,
} from "./nodes.js";
import { scanProject } from "./project-scanner.js";
import type { EnvConfig } from "../config/env.js";
import type { FastifyBaseLogger } from "fastify";

/**
 * Builds the LangGraph coding assistant workflow.
 *
 * Graph topology (ReAct loop):
 *
 *   __start__ → agent → shouldUseTool?
 *                          ├── YES → tool_executor → agent (loop back)
 *                          └── NO  → extract_response → END
 *
 * The agent can iteratively:
 *   1. Read files to understand context
 *   2. Reason about the best approach
 *   3. Write/edit files
 *   4. Run commands to verify
 *   5. Respond to the user
 */
function buildCodingGraph(config: EnvConfig, _logger: FastifyBaseLogger) {
  const agentNode = createAgentNode(config);
  const toolExecutor = createToolExecutorNode();
  const responseExtractor = createResponseExtractor();

  /**
   * Conditional edge: check if the agent wants to use tools.
   * If the last message has tool_calls, route to tool_executor.
   * Otherwise, go to extract_response (we're done).
   */
  function shouldUseTool(state: AgentStateType): "tool_executor" | "extract_response" {
    const lastMessage = state.messages[state.messages.length - 1];

    if (
      lastMessage &&
      "tool_calls" in lastMessage &&
      Array.isArray((lastMessage as AIMessage).tool_calls) &&
      (lastMessage as AIMessage).tool_calls!.length > 0
    ) {
      return "tool_executor";
    }

    return "extract_response";
  }

  const graph = new StateGraph(AgentState)
    .addNode("agent", agentNode)
    .addNode("tool_executor", toolExecutor)
    .addNode("extract_response", responseExtractor)
    // Entry: start with the agent
    .addEdge("__start__", "agent")
    // After agent: check if tools are needed
    .addConditionalEdges("agent", shouldUseTool)
    // After tool execution: loop back to agent for more reasoning
    .addEdge("tool_executor", "agent")
    // After response extraction: done
    .addEdge("extract_response", END);

  return graph.compile();
}

/** Cached compiled graph to avoid re-compilation. */
let cachedGraph: ReturnType<typeof buildCodingGraph> | null = null;

/**
 * Invokes the coding assistant agent.
 *
 * @param params - Message, project path, session, config.
 * @returns Response with session ID, tools used, and files modified.
 */
export async function invokeAgent(params: {
  message: string;
  projectPath?: string;
  sessionId?: string;
  config: EnvConfig;
  logger: FastifyBaseLogger;
}): Promise<{
  sessionId: string;
  response: string;
  toolsUsed: string[];
  filesModified: string[];
  projectInfo?: {
    name: string;
    techStack: string[];
    fileCount: number;
  };
}> {
  const { message, projectPath, sessionId, config, logger } = params;

  if (!cachedGraph) {
    cachedGraph = buildCodingGraph(config, logger);
  }

  // Auto-scan project if path is provided
  let projectContext = "";
  let projectInfo: { name: string; techStack: string[]; fileCount: number } | undefined;

  if (projectPath) {
    try {
      const scanned = await scanProject(projectPath);
      projectContext = scanned.summary;
      projectInfo = {
        name: scanned.name,
        techStack: scanned.techStack,
        fileCount: scanned.fileCount,
      };
      logger.info({ projectName: scanned.name, techStack: scanned.techStack }, "Project scanned");
    } catch (error) {
      logger.warn(error, "Failed to scan project");
      projectContext = `Failed to scan project at: ${projectPath}`;
    }
  }

  const initialState: Partial<AgentStateType> = {
    messages: [new HumanMessage(message)],
    sessionId: sessionId ?? crypto.randomUUID(),
    projectPath: projectPath ?? "",
    projectContext,
    toolsUsed: [],
    filesModified: [],
    finalResponse: "",
  };

  logger.info(
    { sessionId: initialState.sessionId, projectPath },
    "Invoking coding assistant"
  );

  const result = await cachedGraph.invoke(initialState, {
    recursionLimit: 25, // Max tool-calling loops
  });

  return {
    sessionId: result.sessionId,
    response: result.finalResponse,
    toolsUsed: result.toolsUsed,
    filesModified: result.filesModified,
    projectInfo,
  };
}
