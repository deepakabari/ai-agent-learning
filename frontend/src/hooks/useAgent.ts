const API_URL = import.meta.env.VITE_API_URL ?? "";

/** Project scan result. */
export interface ProjectInfo {
  name: string;
  techStack: string[];
  fileTree: string;
  fileCount: number;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
}

/** Response shape from the agent API. */
export interface AgentResponse {
  sessionId: string;
  response: string;
  toolsUsed: string[];
  filesModified: string[];
  projectInfo?: {
    name: string;
    techStack: string[];
    fileCount: number;
  };
}

/** A single chat message. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  filesModified?: string[];
  timestamp: Date;
}

/**
 * Scan a project directory.
 */
export async function scanProject(projectPath: string): Promise<ProjectInfo> {
  const response = await fetch(`${API_URL}/api/project/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectPath }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as Record<string, string>).message ?? `Scan failed: ${response.status}`
    );
  }

  return response.json() as Promise<ProjectInfo>;
}

/**
 * Invoke the AI agent with a user message and optional project context.
 */
export async function invokeAgent(
  message: string,
  sessionId?: string,
  projectPath?: string
): Promise<AgentResponse> {
  const response = await fetch(`${API_URL}/api/agent/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, projectPath }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as Record<string, string>).message ?? `Request failed: ${response.status}`
    );
  }

  return response.json() as Promise<AgentResponse>;
}
