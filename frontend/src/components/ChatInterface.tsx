import { useState, useRef, useEffect, useCallback } from "react";
import {
  invokeAgent,
  type ChatMessage,
  type AgentResponse,
} from "../hooks/useAgent";

/**
 * ChatInterface — the primary UI for the AI Coding Assistant.
 *
 * Enhanced features:
 *   - Project-aware messages (passes projectPath to agent)
 *   - Code block rendering with language labels
 *   - File modification badges
 *   - Tool usage display
 *   - Coding-specific suggestion chips
 */
export function ChatInterface({
  projectPath,
}: {
  projectPath: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setInput("");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const result: AgentResponse = await invokeAgent(
        trimmed,
        sessionId,
        projectPath || undefined
      );
      setSessionId(result.sessionId);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.response,
        toolsUsed: result.toolsUsed,
        filesModified: result.filesModified,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, sessionId, projectPath]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  /** Render message content with code block detection */
  const renderContent = (content: string) => {
    // Split content into text and code blocks
    const parts: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Text before the code block
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
      }
      // The code block
      parts.push({
        type: "code",
        content: match[2] ?? "",
        lang: match[1] || "text",
      });
      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last code block
    if (lastIndex < content.length) {
      parts.push({ type: "text", content: content.slice(lastIndex) });
    }

    // If no code blocks found, just return text
    if (parts.length === 0) {
      return <span>{content}</span>;
    }

    return (
      <>
        {parts.map((part, i) => {
          if (part.type === "code") {
            return (
              <div key={i} className="code-block-wrapper">
                <div className="code-block-header">
                  <span className="code-lang">{part.lang}</span>
                  <button
                    className="code-copy-btn"
                    onClick={() => void navigator.clipboard.writeText(part.content)}
                  >
                    📋 Copy
                  </button>
                </div>
                <pre className="code-block">
                  <code>{part.content}</code>
                </pre>
              </div>
            );
          }
          return <span key={i}>{part.content}</span>;
        })}
      </>
    );
  };

  const suggestions = projectPath
    ? [
        "What is this project's structure?",
        "Find all API route handlers",
        "Add a health check endpoint",
        "Review the error handling",
      ]
    : [
        "What can you help me with?",
        "How do I load a project?",
        "What tools do you have?",
      ];

  return (
    <div className="chat-container">
      {/* Messages Area */}
      <div className="chat-messages" id="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">⚡</div>
            <h2>AI Coding Assistant</h2>
            <p>
              {projectPath
                ? `Project loaded — ask me to read, write, or modify any file.`
                : `Load a project above, then ask me to help with your code.`}
            </p>
            <div className="chat-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="suggestion-chip"
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
            <div className="message-avatar">
              {msg.role === "user" ? "👤" : "🤖"}
            </div>
            <div className="message-content">
              <div className="message-text">{renderContent(msg.content)}</div>

              {/* Files Modified */}
              {msg.filesModified && msg.filesModified.length > 0 && (
                <div className="message-files">
                  📁 Files modified:{" "}
                  {msg.filesModified.map((file) => (
                    <span key={file} className="file-badge">
                      {file}
                    </span>
                  ))}
                </div>
              )}

              {/* Tools Used */}
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div className="message-tools">
                  🔧 Tools:{" "}
                  {msg.toolsUsed.map((tool) => (
                    <span key={tool} className="tool-badge">
                      {tool}
                    </span>
                  ))}
                </div>
              )}

              <div className="message-time">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-message chat-message-assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
              <div className="loading-label">
                {projectPath ? "Reading code & generating..." : "Thinking..."}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-container">
        <textarea
          ref={inputRef}
          id="chat-input"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            projectPath
              ? 'Ask about your code... (Enter to send)'
              : 'Load a project first, or ask a general question...'
          }
          rows={1}
          disabled={isLoading}
        />
        <button
          id="send-button"
          className="send-button"
          onClick={() => void handleSend()}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          {isLoading ? (
            <div className="send-spinner" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2L11 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 2L15 22L11 13L2 9L22 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
