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
          🔗 Sources
          {citations.length > 0 && (
            <span className="citations-count">{citations.length}</span>
          )}
        </div>
      </div>

      <div className="citations-list">
        {citations.length === 0 ? (
          <div className="citations-empty">
            <div className="citations-empty-icon">📖</div>
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

      {/* Footer */}
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
          Grounded in your documents · No hallucinations
        </div>
      )}
    </aside>
  );
}
