"use client";

import { useRef, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import type { UploadedFile, DocumentInfo } from "@/types";
import { formatFileSize } from "@/lib/client-utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILES = 50;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string;
  uploadedFiles: UploadedFile[];
  onFilesUploaded: (files: UploadedFile[]) => void;
  onFileStatusUpdate: (filename: string, update: Partial<UploadedFile>) => void;
  onDocumentRemoved: (docHash: string, filename: string) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

// ─── Document Sidebar ─────────────────────────────────────────────────────────

export default function DocumentSidebar({
  sessionId,
  uploadedFiles,
  onFilesUploaded,
  onFileStatusUpdate,
  onDocumentRemoved,
  showToast,
}: Props) {
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Process a single file through upload → process pipeline ────────────────
  const processFile = useCallback(
    async (file: File) => {
      if (!sessionId) return;

      const filename = file.name;

      // Check if already in list
      const alreadyAdded = uploadedFiles.some((f) => f.filename === filename);
      if (alreadyAdded) {
        showToast(`"${filename}" is already in the list`, "info");
        return;
      }

      // Validate
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        showToast(`"${filename}" is not a PDF`, "error");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(`"${filename}" exceeds 50 MB limit`, "error");
        return;
      }

      // Add to list as uploading
      const initialFile: UploadedFile = {
        filename,
        blobUrl: "",
        size: file.size,
        status: "uploading",
      };
      onFilesUploaded([initialFile]);

      try {
        // Step 1: Upload to Vercel Blob
        const blob = await upload(filename, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: sessionId,
        });

        onFileStatusUpdate(filename, { blobUrl: blob.url, status: "processing" });

        // Step 2: Process (extract, embed, upsert)
        const processRes = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobUrl: blob.url,
            filename,
            sessionId,
          }),
        });

        const processData = await processRes.json();

        if (!processRes.ok || !processData.success) {
          throw new Error(processData.error ?? "Processing failed");
        }

        if (processData.skipped) {
          onFileStatusUpdate(filename, {
            status: "duplicate",
            docInfo: {
              docHash: processData.docHash,
              filename,
              pageCount: 0,
              chunkCount: 0,
              uploadedAt: new Date().toISOString(),
            },
          });
          showToast(`"${filename}" already processed (skipped re-embedding)`, "info");
        } else {
          const docInfo: DocumentInfo = {
            docHash: processData.docHash,
            filename,
            pageCount: processData.pageCount,
            chunkCount: processData.chunkCount,
            uploadedAt: new Date().toISOString(),
            blobUrl: blob.url,
          };
          onFileStatusUpdate(filename, { status: "done", docInfo });
          showToast(`✅ "${filename}" ready — ${processData.pageCount} pages, ${processData.chunkCount} chunks`, "success");
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Upload failed";
        onFileStatusUpdate(filename, { status: "error", error: msg });
        showToast(`Failed to process "${filename}": ${msg}`, "error");
      }
    },
    [sessionId, uploadedFiles, onFilesUploaded, onFileStatusUpdate, showToast]
  );

  // ─── File input handler ──────────────────────────────────────────────────────
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const fileArray = Array.from(files);

      const currentCount = uploadedFiles.length;
      const remaining = MAX_FILES - currentCount;

      if (fileArray.length > remaining) {
        showToast(`Max ${MAX_FILES} files. You can add ${remaining} more.`, "error");
        return;
      }

      // Process files sequentially to avoid rate limits
      fileArray.forEach((file, i) => {
        setTimeout(() => processFile(file), i * 500);
      });
    },
    [uploadedFiles.length, processFile, showToast]
  );

  // ─── Drag and drop ───────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.add("drag-over");
  };
  const handleDragLeave = () => {
    dropRef.current?.classList.remove("drag-over");
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  };

  const doneCount = uploadedFiles.filter((f) => f.status === "done" || f.status === "duplicate").length;

  return (
    <aside className="doc-sidebar">
      {/* Upload zone */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          📁 Documents
          {doneCount > 0 && (
            <span
              style={{
                background: "rgba(16,185,129,0.1)",
                color: "var(--accent-emerald)",
                padding: "2px 8px",
                borderRadius: "99px",
                fontSize: "11px",
                fontWeight: 600,
                marginLeft: "8px",
              }}
            >
              {doneCount} ready
            </span>
          )}
        </div>

        <div
          ref={dropRef}
          className="upload-zone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF files"
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="upload-input"
            onChange={(e) => handleFiles(e.target.files)}
            aria-hidden="true"
          />
          <span className="upload-icon">📄</span>
          <div className="upload-text">Drop PDFs here</div>
          <div className="upload-subtext">or click to browse · max 50 files</div>
        </div>
      </div>

      {/* Document list */}
      <div className="sidebar-docs">
        {uploadedFiles.length === 0 ? (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">📭</div>
            <p>No documents yet.</p>
            <p style={{ marginTop: "6px" }}>Upload PDFs to start chatting.</p>
          </div>
        ) : (
          uploadedFiles.map((file) => (
            <div key={file.filename} className="doc-item">
              <div className="doc-icon">
                {file.status === "error" ? "❌" : file.status === "duplicate" ? "♻️" : "📄"}
              </div>

              <div className="doc-info">
                <div className="doc-name" title={file.filename}>
                  {file.filename}
                </div>
                <div className="doc-meta">
                  {file.status === "done" && file.docInfo
                    ? `${file.docInfo.pageCount} pages · ${file.docInfo.chunkCount} chunks`
                    : file.status === "duplicate"
                    ? "Already indexed"
                    : file.status === "error"
                    ? file.error ?? "Error"
                    : formatFileSize(file.size)}
                </div>

                {/* Status badge */}
                <div style={{ marginTop: "5px" }}>
                  {file.status === "uploading" && (
                    <span className="doc-status processing">⬆ Uploading…</span>
                  )}
                  {file.status === "processing" && (
                    <span className="doc-status processing">⚙ Processing…</span>
                  )}
                  {file.status === "done" && (
                    <span className="doc-status done">✓ Ready</span>
                  )}
                  {file.status === "duplicate" && (
                    <span className="doc-status duplicate">♻ Cached</span>
                  )}
                  {file.status === "error" && (
                    <span className="doc-status error">✗ Failed</span>
                  )}
                </div>

                {/* Progress bar for uploading/processing */}
                {(file.status === "uploading" || file.status === "processing") && (
                  <div className="progress-bar">
                    <div className="progress-fill indeterminate" />
                  </div>
                )}
              </div>

              {/* Remove button */}
              {file.docInfo && (
                <div className="doc-actions">
                  <button
                    className="doc-remove"
                    onClick={() => onDocumentRemoved(file.docInfo!.docHash, file.filename)}
                    title="Remove document"
                    aria-label={`Remove ${file.filename}`}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      {uploadedFiles.length > 0 && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--glass-border)",
            fontSize: "11px",
            color: "var(--text-muted)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{uploadedFiles.length}/{MAX_FILES} files</span>
          <span>
            {uploadedFiles.filter((f) => f.status === "done").length} indexed
          </span>
        </div>
      )}
    </aside>
  );
}
