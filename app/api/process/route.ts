import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF, createDocumentChunks, buildPineconeVectors } from "@/lib/pdf-processor";
import { generateEmbeddings } from "@/lib/gemini";
import { documentExists, upsertVectors } from "@/lib/pinecone";
import { computeHash } from "@/lib/utils";
import { del } from "@vercel/blob";
import type { ProcessResponse } from "@/types";

export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse<ProcessResponse>> {
  let body: { buffer?: string; blobUrl?: string; filename: string; sessionId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, docHash: "", filename: "", pageCount: 0, chunkCount: 0, skipped: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { buffer: base64Buffer, blobUrl, filename, sessionId } = body;

  if ((!base64Buffer && !blobUrl) || !filename || !sessionId) {
    return NextResponse.json(
      { success: false, docHash: "", filename, pageCount: 0, chunkCount: 0, skipped: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    let pdfBuffer: Buffer;

    if (blobUrl) {
      // ── Fetch PDF from Vercel Blob (client-upload flow) ──────────────────────
      const blobRes = await fetch(blobUrl);
      if (!blobRes.ok) {
        throw new Error(`Failed to fetch uploaded file from storage (${blobRes.status})`);
      }
      const arrayBuffer = await blobRes.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    } else {
      // ── Decode base64 buffer (legacy / local-dev fallback) ───────────────────
      pdfBuffer = Buffer.from(base64Buffer!, "base64");
    }

    // 2. Compute hash for deduplication
    const docHash = computeHash(pdfBuffer);

    // 3. Check if already processed for this session
    const alreadyExists = await documentExists(docHash, sessionId);
    if (alreadyExists) {
      // Clean up blob even for duplicates
      if (blobUrl) {
        await del(blobUrl).catch(() => {/* ignore cleanup errors */});
      }
      return NextResponse.json({
        success: true,
        docHash,
        filename,
        pageCount: 0,
        chunkCount: 0,
        skipped: true,
      });
    }

    // 4. Extract text per page
    const pages = await extractTextFromPDF(pdfBuffer);
    if (pages.length === 0) {
      throw new Error("No readable text found in this PDF. It may be scanned or image-based.");
    }

    // 5. Chunk the text
    const chunks = createDocumentChunks(pages, filename, sessionId, docHash);
    if (chunks.length === 0) {
      throw new Error("Could not create any text chunks from this PDF.");
    }

    // 6. Generate embeddings (batched)
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(chunkTexts);

    // 7. Build and upsert Pinecone vectors
    const vectors = buildPineconeVectors(chunks, embeddings);
    await upsertVectors(vectors);

    // 8. Clean up the temporary blob now that processing is done
    if (blobUrl) {
      await del(blobUrl).catch(() => {/* ignore cleanup errors */});
    }

    return NextResponse.json({
      success: true,
      docHash,
      filename,
      pageCount: pages.length,
      chunkCount: chunks.length,
      skipped: false,
    });
  } catch (error) {
    console.error("PDF processing error:", error);
    // Best-effort blob cleanup on error too
    if (blobUrl) {
      await del(blobUrl).catch(() => {});
    }
    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json(
      { success: false, docHash: "", filename, pageCount: 0, chunkCount: 0, skipped: false, error: message },
      { status: 500 }
    );
  }
}
