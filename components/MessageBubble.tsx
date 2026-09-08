"use client";

import { useMemo } from "react";
import type { Message } from "@/types";
import LoadingDots from "./LoadingDots";

interface Props {
  message: Message;
  isStreaming?: boolean;
}

// ─── Minimal markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  // Remove citations block or raw JSON leaks before rendering
  let clean = text
    .replace(/```citations[\s\S]*?```/gi, "")
    .replace(/```json\s*\[\s*\{[\s\S]*?```/gi, "")
    .replace(/\bcitations\s*\[\s*\{[\s\S]*$/gi, "")
    .replace(/\[\s*\{\s*"filename"[\s\S]*$/gi, "")
    .trim();

  // Escape HTML
  clean = clean
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Normalize inline bullet points that LLMs sometimes output without newlines
  clean = clean.replace(/(\n|^|\s)\*\s+/g, "\n* ");

  // Code blocks (must be before inline code)
  clean = clean.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  clean = clean.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headers
  clean = clean.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  clean = clean.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  clean = clean.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold + italic
  clean = clean.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  clean = clean.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  clean = clean.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Blockquotes
  clean = clean.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Horizontal rules
  clean = clean.replace(/^---$/gm, "<hr>");

  // Unordered lists
  clean = clean.replace(/^[*-] (.+)$/gm, "<li>$1</li>");
  clean = clean.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

  // Ordered lists
  clean = clean.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Paragraphs (wrap non-tagged lines)
  clean = clean
    .split("\n\n")
    .map((block) => {
      const b = block.trim();
      if (!b) return "";
      if (
        b.startsWith("<h") ||
        b.startsWith("<pre") ||
        b.startsWith("<ul") ||
        b.startsWith("<ol") ||
        b.startsWith("<blockquote") ||
        b.startsWith("<hr")
      ) {
        return b;
      }
      // Convert single newlines to <br>
      return `<p>${b.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return clean;
}

// ─── Message Bubble ────────────────────────────────────────────────────────────

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const renderedContent = useMemo(() => {
    if (isUser) return null;
    return renderMarkdown(message.content);
  }, [isUser, message.content]);

  const timeString = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`message ${message.role}`}>
      {/* Avatar */}
      <div className="message-avatar" aria-hidden="true">
        {isUser ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </div>

      {/* Body */}
      <div className="message-body">
        {isUser ? (
          <div className="message-bubble">
            {message.content}
          </div>
        ) : (
          <div className="message-bubble">
            {isStreaming && message.content === "" ? (
              <LoadingDots />
            ) : (
              <>
                <div
                  className="message-content"
                  dangerouslySetInnerHTML={{ __html: renderedContent ?? "" }}
                />
                {isStreaming && (
                  <span className="streaming-cursor" aria-hidden="true" />
                )}
              </>
            )}
          </div>
        )}

        {/* Timestamp + citation count */}
        <div className="message-time">
          {timeString}
          {isAssistant && message.citations && message.citations.length > 0 && (
            <span
              style={{
                marginLeft: "8px",
                background: "rgba(99,102,241,0.12)",
                color: "var(--text-accent)",
                padding: "1px 7px",
                borderRadius: "99px",
                fontSize: "10px",
                fontWeight: 600,
              }}
            >
              {message.citations.length} source{message.citations.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
