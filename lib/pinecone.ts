import "server-only";
import { Pinecone } from "@pinecone-database/pinecone";
import type { PineconeVector, RetrievedChunk, ChunkMetadata } from "@/types";

// ─── Singleton client ─────────────────────────────────────────────────────────

let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error("PINECONE_API_KEY is not set.");
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

function getIndex() {
  const indexName = process.env.PINECONE_INDEX_NAME;
  if (!indexName) throw new Error("PINECONE_INDEX_NAME is not set.");
  return getPineconeClient().index(indexName);
}

// ─── Document Existence Check ─────────────────────────────────────────────────

/**
 * Check if a document with this hash has already been embedded for this session.
 * Uses a zero-vector query with metadata filter.
 */
export async function documentExists(
  docHash: string,
  sessionId: string
): Promise<boolean> {
  try {
    const index = getIndex();
    const results = await index.query({
      vector: new Array(768).fill(0),
      topK: 1,
      filter: { docHash: { $eq: docHash }, sessionId: { $eq: sessionId } },
      includeMetadata: true,
    });
    return (results.matches?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// ─── Upsert Vectors ───────────────────────────────────────────────────────────

/**
 * Upsert a batch of vectors into Pinecone.
 * Uses Pinecone v8 API: index.upsert({ records: [...] })
 * Automatically splits into batches of 100.
 */
export async function upsertVectors(vectors: PineconeVector[]): Promise<void> {
  const index = getIndex();
  const BATCH_SIZE = 100;

  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await index.upsert({
      records: batch.map((v) => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata as unknown as Record<string, string | number | boolean>,
      })),
    });
  }
}

// ─── Semantic Search ──────────────────────────────────────────────────────────

/**
 * Perform Top-K semantic search for a query embedding.
 * Filters by sessionId so users only see their own documents.
 */
export async function semanticSearch(
  queryEmbedding: number[],
  sessionId: string,
  topK: number = 5,
  scoreThreshold: number = 0.3
): Promise<RetrievedChunk[]> {
  const index = getIndex();

  const results = await index.query({
    vector: queryEmbedding,
    topK: topK * 2, // over-fetch, then filter by score
    filter: { sessionId: { $eq: sessionId } },
    includeMetadata: true,
    includeValues: false,
  });

  if (!results.matches) return [];

  const chunks: RetrievedChunk[] = results.matches
    .filter((m) => (m.score ?? 0) >= scoreThreshold)
    .slice(0, topK)
    .map((m) => ({
      text: (m.metadata?.text as string) ?? "",
      score: m.score ?? 0,
      metadata: {
        filename: (m.metadata?.filename as string) ?? "",
        pageNumber: (m.metadata?.pageNumber as number) ?? 1,
        chunkIndex: (m.metadata?.chunkIndex as number) ?? 0,
        sessionId: (m.metadata?.sessionId as string) ?? "",
        docHash: (m.metadata?.docHash as string) ?? "",
        totalPages: (m.metadata?.totalPages as number) ?? 1,
        uploadedAt: (m.metadata?.uploadedAt as string) ?? "",
      } as ChunkMetadata,
    }));

  return chunks;
}

// ─── List Documents ───────────────────────────────────────────────────────────

/**
 * Get all unique documents for a session by fetching a broad sample
 * and deduplicating by docHash.
 */
export async function listDocumentsForSession(sessionId: string): Promise<
  {
    docHash: string;
    filename: string;
    pageCount: number;
    chunkCount: number;
    uploadedAt: string;
  }[]
> {
  const index = getIndex();

  // Query with a zero vector to sample all documents (metadata only)
  const results = await index.query({
    vector: new Array(768).fill(0),
    topK: 1000,
    filter: { sessionId: { $eq: sessionId } },
    includeMetadata: true,
    includeValues: false,
  });

  if (!results.matches) return [];

  // Deduplicate and aggregate by docHash
  const docMap = new Map<
    string,
    {
      docHash: string;
      filename: string;
      pageCount: number;
      chunkCount: number;
      uploadedAt: string;
    }
  >();

  for (const match of results.matches) {
    const meta = match.metadata as Record<string, unknown>;
    const docHash = meta?.docHash as string;
    if (!docHash) continue;

    if (docMap.has(docHash)) {
      const existing = docMap.get(docHash)!;
      existing.chunkCount += 1;
    } else {
      docMap.set(docHash, {
        docHash,
        filename: (meta?.filename as string) ?? "Unknown",
        pageCount: (meta?.totalPages as number) ?? 1,
        chunkCount: 1,
        uploadedAt: (meta?.uploadedAt as string) ?? new Date().toISOString(),
      });
    }
  }

  return Array.from(docMap.values());
}

// ─── Delete Document ──────────────────────────────────────────────────────────

/**
 * Delete all vectors associated with a document hash in a session.
 * Fetches IDs first, then deletes in batches.
 */
export async function deleteDocumentVectors(
  docHash: string,
  sessionId: string
): Promise<void> {
  const index = getIndex();

  // Fetch IDs to delete
  const results = await index.query({
    vector: new Array(768).fill(0),
    topK: 1000,
    filter: {
      docHash: { $eq: docHash },
      sessionId: { $eq: sessionId },
    },
    includeMetadata: false,
    includeValues: false,
  });

  if (!results.matches?.length) return;

  const ids = results.matches.map((m) => m.id);

  // Delete in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    await index.deleteMany(ids.slice(i, i + BATCH_SIZE));
  }
}
