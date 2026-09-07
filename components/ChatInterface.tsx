"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import DocumentSidebar from "./DocumentSidebar";
import MessageBubble from "./MessageBubble";
import CitationPanel from "./CitationPanel";
import LoadingDots from "./LoadingDots";
import type { Message, Citation, DocumentInfo, UploadedFile } from "@/types";

// ─── Session ID Management ────────────────────────────────────────────────────

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("rag-session-id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("rag-session-id", id);
  }
  return id;
}

// ─── Toast System ─────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatInterface() {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Init session
  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  };

  // ─── Toast helpers ──────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // ─── Document management ────────────────────────────────────────────────────
  const handleFilesUploaded = useCallback((files: UploadedFile[]) => {
    setUploadedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.filename));
      const newFiles = files.filter((f) => !existingNames.has(f.filename));
      return [...prev, ...newFiles];
    });
  }, []);

  const handleFileStatusUpdate = useCallback((filename: string, update: Partial<UploadedFile>) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.filename === filename ? { ...f, ...update } : f))
    );
  }, []);

  const handleDocumentRemoved = useCallback(
    async (docHash: string, filename: string) => {
      try {
        await fetch("/api/documents", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docHash, sessionId }),
        });
        setUploadedFiles((prev) => prev.filter((f) => f.docInfo?.docHash !== docHash));
        showToast(`Removed "${filename}"`, "info");
      } catch {
        showToast("Failed to remove document", "error");
      }
    },
    [sessionId, showToast]
  );

  // ─── Chat submission ────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = query.trim();
    if (!trimmed || isStreaming || !sessionId) return;

    const hasDocs = uploadedFiles.some((f) => f.status === "done");
    if (!hasDocs) {
      showToast("Please upload at least one PDF before chatting", "error");
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setQuery("");
    setIsStreaming(true);
    setActiveCitations([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Build history (last 6 exchanges)
    const history = messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, sessionId, history }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to chat service");
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "token") {
              fullContent += event.content;
              // Strip the citations block from displayed content
              const displayContent = fullContent.replace(/```citations[\s\S]*?```/g, "").trim();
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: displayContent } : m
                )
              );
            } else if (event.type === "citations") {
              const citations: Citation[] = event.citations ?? [];
              setActiveCitations(citations);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, citations } : m
                )
              );
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // Skip malformed events
          }
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An error occurred";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `**Error**: ${errMsg}\n\nPlease try again. If the issue persists, check that your documents have been processed successfully.`,
              }
            : m
        )
      );
      showToast(errMsg, "error");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasDocs = uploadedFiles.some((f) => f.status === "done");

  return (
    <>
      <div className="app-container">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="app-header">
          <div className="header-brand">
            <div className="header-logo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <div className="header-title">DocMind AI</div>
              <div className="header-subtitle">RAG-Powered Document Chat</div>
            </div>
          </div>

          <div className="header-actions">
            <div className="status-badge">
              <div className="status-dot" />
              Gemini 2.5 Flash
            </div>
          </div>
        </header>

        {/* ── Document Sidebar ────────────────────────────── */}
        <DocumentSidebar
          sessionId={sessionId}
          uploadedFiles={uploadedFiles}
          onFilesUploaded={handleFilesUploaded}
          onFileStatusUpdate={handleFileStatusUpdate}
          onDocumentRemoved={handleDocumentRemoved}
          showToast={showToast}
        />

        {/* ── Chat Area ───────────────────────────────────── */}
        <main className="chat-area">
          <div className="chat-messages" id="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-welcome">
                <div className="welcome-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <h2 className="welcome-title">Ask Your Documents</h2>
                <p className="welcome-desc">
                  Upload PDFs using the sidebar, then ask any question. The AI will
                  search across all your documents and give you cited, grounded
                  answers.
                </p>
                <div className="feature-chips">
                  <div className="chip">Up to 50 PDFs</div>
                  <div className="chip">Semantic Search</div>
                  <div className="chip">Cross-doc Analysis</div>
                  <div className="chip">Citations</div>
                  <div className="chip">Streaming</div>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="chat-input-area">
            <div className="chat-input-wrapper">
              <textarea
                ref={textareaRef}
                id="chat-input"
                className="chat-textarea"
                placeholder={
                  hasDocs
                    ? "Ask a question about your documents…"
                    : "Upload PDFs first, then ask questions…"
                }
                value={query}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                rows={1}
                aria-label="Chat message input"
              />
              <button
                id="send-btn"
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!query.trim() || isStreaming || !hasDocs}
                aria-label="Send message"
              >
                {isStreaming ? (
                  <LoadingDots size="small" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            <p className="chat-hint">
              Press <kbd style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: "4px", fontSize: "11px" }}>Enter</kbd> to send ·{" "}
              <kbd style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: "4px", fontSize: "11px" }}>Shift+Enter</kbd> for new line
            </p>
          </div>
        </main>

        {/* ── Citations Panel ─────────────────────────────── */}
        <CitationPanel citations={activeCitations} />
      </div>

      {/* ── Toast Notifications ─────────────────────────── */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`} role="status">
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
