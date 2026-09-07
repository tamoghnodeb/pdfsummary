"use client";

import type { Citation } from "@/types";

interface Props {
  citations: Citation[];
}

export default function CitationPanel({ citations }: Props) {
  return (
    <aside className="citations-panel">
      <div className="citations-header">
        <div className="citations-title">
          Sources
          {citations.length > 0 && (
            <span className="citations-count">{citations.length}</span>
          )}
        </div>
      </div>

      <div className="citations-list">
        {citations.length === 0 ? (
          <div className="citations-empty">
            <div className="citations-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <p>Sources will appear here after each response.</p>
          </div>
        ) : (
          citations.map((citation, i) => (
            <div key={`${citation.docHash}-${citation.pageNumber}-${i}`} className="citation-card">
              <div className="citation-card-header">
                <div className="citation-num">{i + 1}</div>
                <div className="citation-filename" title={citation.filename}>
                  {citation.filename}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                }}
              >
                <span className="citation-page">p. {citation.pageNumber}</span>
                <span className="citation-score">{Math.round(citation.score * 100)}% match</span>
              </div>

              {citation.chunkText && (
                <div className="citation-excerpt">
                  &ldquo;{citation.chunkText}&rdquo;
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {citations.length > 0 && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--glass-border)",
            fontSize: "11px",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          Grounded in your documents
        </div>
      )}
    </aside>
  );
}
