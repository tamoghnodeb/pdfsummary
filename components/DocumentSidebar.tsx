"use client";

import { useRef, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import type { UploadedFile, DocumentInfo } from "@/types";
import { formatFileSize } from "@/lib/client-utils";

const MAX_FILES = 50;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

interface Props {
  sessionId: string;
  uploadedFiles: UploadedFile[];
  onFilesUploaded: (files: UploadedFile[]) => void;
  onFileStatusUpdate: (filename: string, update: Partial<UploadedFile>) => void;
  onDocumentRemoved: (docHash: string, filename: string) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

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

  const processFile = useCallback(
    async (file: File) => {
      if (!sessionId) return;

      const filename = file.name;

      const alreadyAdded = uploadedFiles.some((f) => f.filename === filename);
      if (alreadyAdded) {
        showToast(`"${filename}" is already in the list`, "info");
        return;
      }

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        showToast(`"${filename}" is not a PDF`, "error");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(`"${filename}" exceeds 50 MB limit`, "error");
        return;
      }

      const initialFile: UploadedFile = {
        filename,
        blobUrl: "",
        size: file.size,
        status: "uploading",
      };
      onFilesUploaded([initialFile]);

      try {
        // Upload directly to Vercel Blob (bypasses Vercel's 4.5 MB API body limit)
        const blob = await upload(filename, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });

        onFileStatusUpdate(filename, { status: "processing" });

        // Send only the blob URL to /api/process — no large body
        const processRes = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blobUrl: blob.url, filename, sessionId }),
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
          showToast(`"${filename}" already indexed (skipped re-embedding)`, "info");
        } else {
          const docInfo: DocumentInfo = {
            docHash: processData.docHash,
            filename,
            pageCount: processData.pageCount,
            chunkCount: processData.chunkCount,
            uploadedAt: new Date().toISOString(),
          };
          onFileStatusUpdate(filename, { status: "done", docInfo });
          showToast(
            `"${filename}" ready - ${processData.pageCount} pages, ${processData.chunkCount} chunks`,
            "success"
          );
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Upload failed";
        onFileStatusUpdate(filename, { status: "error", error: msg });
        showToast(`Failed: "${filename}" - ${msg}`, "error");
      }
    },
    [sessionId, uploadedFiles, onFilesUploaded, onFileStatusUpdate, showToast]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const fileArray = Array.from(files);
      const remaining = MAX_FILES - uploadedFiles.length;

      if (fileArray.length > remaining) {
        showToast(`Max ${MAX_FILES} files. You can add ${remaining} more.`, "error");
        return;
      }

      fileArray.forEach((file, i) => {
        setTimeout(() => processFile(file), i * 300);
      });
    },
    [uploadedFiles.length, processFile, showToast]
  );

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

  const doneCount = uploadedFiles.filter(
    (f) => f.status === "done" || f.status === "duplicate"
  ).length;

  return (
    <aside className="doc-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          Documents
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
          <span className="upload-icon-svg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </span>
          <div className="upload-text">Drop PDFs here</div>
          <div className="upload-subtext">or click to browse · max 50 files</div>
        </div>
      </div>

      <div className="sidebar-docs">
        {uploadedFiles.length === 0 ? (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{opacity: 0.3}}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p>No documents yet.</p>
            <p style={{ marginTop: "6px" }}>Upload PDFs to start chatting.</p>
          </div>
        ) : (
          uploadedFiles.map((file) => (
            <div key={file.filename} className="doc-item">
              <div className="doc-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
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

                <div style={{ marginTop: "5px" }}>
                  {file.status === "uploading" && (
                    <span className="doc-status processing">Reading...</span>
                  )}
                  {file.status === "processing" && (
                    <span className="doc-status processing">Processing...</span>
                  )}
                  {file.status === "done" && (
                    <span className="doc-status done">Ready</span>
                  )}
                  {file.status === "duplicate" && (
                    <span className="doc-status duplicate">Cached</span>
                  )}
                  {file.status === "error" && (
                    <span className="doc-status error">Failed</span>
                  )}
                </div>

                {(file.status === "uploading" || file.status === "processing") && (
                  <div className="progress-bar">
                    <div className="progress-fill indeterminate" />
                  </div>
                )}
              </div>

              {file.docInfo && (
                <div className="doc-actions">
                  <button
                    className="doc-remove"
                    onClick={() => onDocumentRemoved(file.docInfo!.docHash, file.filename)}
                    title="Remove document"
                    aria-label={`Remove ${file.filename}`}
                  >
                    x
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

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
          <span>{uploadedFiles.filter((f) => f.status === "done").length} indexed</span>
        </div>
      )}
    </aside>
  );
}
