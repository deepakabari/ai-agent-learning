import { useState, Suspense } from "react";
import { ChatInterface } from "./components/ChatInterface";
import { ProjectBar } from "./components/ProjectBar";
import type { ProjectInfo } from "./hooks/useAgent";

/**
 * Root application component.
 * Uses Suspense for async UI boundaries.
 */
export function App() {
  const [projectPath, setProjectPath] = useState("");
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <h1>Code Assistant</h1>
        </div>
        <p className="tagline">AI-Powered • MCP • LangGraph</p>
      </header>

      {/* Project Selector */}
      <ProjectBar
        projectPath={projectPath}
        onProjectPathChange={setProjectPath}
        projectInfo={projectInfo}
        onProjectLoaded={setProjectInfo}
      />

      <main className="app-main">
        <Suspense
          fallback={
            <div className="loading-container">
              <div className="loading-spinner" />
              <p>Initializing agent...</p>
            </div>
          }
        >
          <ChatInterface projectPath={projectPath} />
        </Suspense>
      </main>

      <footer className="app-footer">
        <p>
          Skills-First Architecture • Google Gemini •{" "}
          <a
            href="https://github.com/deepakabari/ai-agent-learning"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
