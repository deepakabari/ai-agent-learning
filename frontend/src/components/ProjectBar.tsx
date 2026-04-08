import { useState, useCallback, useEffect } from "react";
import { scanProject, type ProjectInfo } from "../hooks/useAgent";

/**
 * ProjectBar — lets the user set a project path
 * and displays the scanned project info.
 */
export function ProjectBar({
  projectPath,
  onProjectPathChange,
  projectInfo,
  onProjectLoaded,
}: {
  projectPath: string;
  onProjectPathChange: (path: string) => void;
  projectInfo: ProjectInfo | null;
  onProjectLoaded: (info: ProjectInfo | null) => void;
}) {
  const [inputPath, setInputPath] = useState(projectPath);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep input in sync with external path (e.g., from auto-load)
  useEffect(() => {
    setInputPath(projectPath);
  }, [projectPath]);

  const handleLoad = useCallback(async () => {
    const trimmed = inputPath.trim();
    if (!trimmed) return;

    setError(null);
    setIsScanning(true);

    try {
      const info = await scanProject(trimmed);
      onProjectPathChange(trimmed);
      onProjectLoaded(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan project");
    } finally {
      setIsScanning(false);
    }
  }, [inputPath, onProjectPathChange, onProjectLoaded]);

  const handleClear = useCallback(() => {
    setInputPath("");
    onProjectPathChange("");
    onProjectLoaded(null);
    setError(null);
  }, [onProjectPathChange, onProjectLoaded]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleLoad();
      }
    },
    [handleLoad]
  );

  const isGithub = inputPath.toLowerCase().includes("github.com");

  return (
    <div className="project-bar">
      <div className="project-input-row">
        <div className="project-icon" title="Project Path or GitHub URL">
          {isGithub ? "🌐" : "📂"}
        </div>
        <input
          id="project-path-input"
          type="text"
          className="project-input"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Path (D:\app) or GitHub URL (https://...)"
          disabled={isScanning}
        />
        
        {projectPath && (
          <button
            className="project-clear-btn"
            onClick={handleClear}
            title="Clear project"
            disabled={isScanning}
          >
            ✕
          </button>
        )}

        <button
          id="load-project-btn"
          className="project-load-btn"
          onClick={() => void handleLoad()}
          disabled={!inputPath.trim() || isScanning}
        >
          {isScanning ? (
            <div className="btn-spinner" />
          ) : (
            "Load"
          )}
        </button>
      </div>

      {error && (
        <div className="project-error">
          ⚠️ {error}
        </div>
      )}

      {projectInfo && (
        <div className="project-info">
          <div className="project-name">
            <span className="project-name-icon">📦</span>
            <strong>{projectInfo.name}</strong>
            <span className="project-file-count">{projectInfo.fileCount} files</span>
          </div>
          <div className="project-tech-stack">
            {projectInfo.techStack.map((tech) => (
              <span key={tech} className="tech-badge">
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
