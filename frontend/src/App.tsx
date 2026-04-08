import { useState, Suspense, useEffect } from "react";
import { ChatInterface } from "./components/ChatInterface";
import { ProjectBar } from "./components/ProjectBar";
import { scanProject, type ProjectInfo } from "./hooks/useAgent";

const PROJECT_PATH_KEY = "ai_assistant_project_path";

/**
 * Root application component.
 * Uses Suspense for async UI boundaries.
 */
export function App() {
  // Initialize from localStorage or fallback to empty
  const [projectPath, setProjectPath] = useState(() => 
    localStorage.getItem(PROJECT_PATH_KEY) || ""
  );
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isAutoLoading, setIsAutoLoading] = useState(false);

  // Persistence: Save path when it changes
  useEffect(() => {
    localStorage.setItem(PROJECT_PATH_KEY, projectPath);
  }, [projectPath]);

  // Auto-load project info if a path exists on mount
  useEffect(() => {
    const autoLoad = async () => {
      if (projectPath && !projectInfo && !isAutoLoading) {
        setIsAutoLoading(true);
        try {
          const info = await scanProject(projectPath);
          setProjectInfo(info);
        } catch (err) {
          console.error("Auto-load project failed:", err);
          // Don't Alert on auto-load to avoid annoying popups
        } finally {
          setIsAutoLoading(false);
        }
      }
    };
    void autoLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

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
