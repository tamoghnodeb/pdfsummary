// ─── Message & Chat Types ───────────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

export interface Citation {
  filename: string;
  pageNumber: number;
  chunkText: string;
  score: number;
  docHash: string;
}

// ─── Document Types ──────────────────────────────────────────────────────────

export interface DocumentInfo {
  docHash: string;
  filename: string;
  pageCount: number;
  chunkCount: number;
  uploadedAt: string;
  blobUrl?: string;
}

export interface ChunkMetadata {
  filename: string;
  pageNumber: number;
  chunkIndex: number;
  sessionId: string;
  docHash: string;
  totalPages: number;
  uploadedAt: string;
}

// ─── API Request / Response Types ───────────────────────────────────────────

export interface ProcessRequest {
  blobUrl: string;
  filename: string;
  sessionId: string;
}

export interface ProcessResponse {
  success: boolean;
  docHash: string;
  filename: string;
  pageCount: number;
  chunkCount: number;
  skipped: boolean;
  error?: string;
}

export interface ChatRequest {
  query: string;
  sessionId: string;
  history: { role: "user" | "assistant"; content: string }[];
}

export interface DocumentListResponse {
  documents: DocumentInfo[];
}

export interface DeleteDocumentRequest {
  docHash: string;
  sessionId: string;
}

// ─── Upload Types ────────────────────────────────────────────────────────────

export interface UploadedFile {
  filename: string;
  blobUrl: string;
  size: number;
  status: "uploading" | "processing" | "done" | "error" | "duplicate";
  error?: string;
  docInfo?: DocumentInfo;
}

// ─── Pinecone Types ──────────────────────────────────────────────────────────

export interface PineconeVector {
  id: string;
  values: number[];
  metadata: ChunkMetadata & { text: string };
}

export interface RetrievedChunk {
  text: string;
  metadata: ChunkMetadata;
  score: number;
}
