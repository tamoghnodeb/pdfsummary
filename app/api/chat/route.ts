import { NextRequest } from "next/server";
import { generateQueryEmbedding, streamRAGResponse } from "@/lib/gemini";
import { semanticSearch } from "@/lib/pinecone";
import { truncate } from "@/lib/utils";
import type { ChatRequest, Citation, RetrievedChunk } from "@/types";

export const maxDuration = 60;

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildContextString(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant document context found for this query.";
  }

  const parts = chunks.map((chunk, i) => {
    return `[Source ${i + 1}: "${chunk.metadata.filename}", Page ${chunk.metadata.pageNumber}]
${chunk.text}`;
  });

  return parts.join("\n\n---\n\n");
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const { query, sessionId, history } = body;

  if (!query?.trim() || !sessionId) {
    return new Response("Missing query or sessionId", { status: 400 });
  }

  try {
    // 1. Embed the query
    const queryEmbedding = await generateQueryEmbedding(query);

    // 2. Semantic search — Top-5 chunks
    const retrievedChunks = await semanticSearch(queryEmbedding, sessionId, 5);

    // 3. Build context string with source attribution
    const context = buildContextString(retrievedChunks);

    // 4. Build chat history for Gemini
    const geminiHistory = history.slice(-6).map((msg) => ({
      role: msg.role === "user" ? "user" : ("model" as "user" | "model"),
      parts: [{ text: msg.content }],
    }));

    // 5. Build citations metadata to append at end of stream
    const citations: Citation[] = retrievedChunks.map((chunk) => ({
      filename: chunk.metadata.filename,
      pageNumber: chunk.metadata.pageNumber,
      chunkText: truncate(chunk.text, 200),
      score: Math.round(chunk.score * 100) / 100,
      docHash: chunk.metadata.docHash,
    }));

    // 6. Stream response from Gemini
    const geminiStream = await streamRAGResponse(query, context, geminiHistory);

    // 7. Transform the stream: pipe Gemini output, then append citations JSON
    const encoder = new TextEncoder();
    let fullResponse = "";

    const transformedStream = new ReadableStream({
      async start(controller) {
        const reader = geminiStream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            fullResponse += text;

            // Send as SSE data
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", content: text })}\n\n`)
            );
          }

          // Strip the ```citations block from the displayed text if present,
          // and instead send structured citations JSON
          const citationsBlockMatch = fullResponse.match(/```citations\s*([\s\S]*?)\s*```/);
          let parsedCitations = citations;

          if (citationsBlockMatch) {
            try {
              const jsonStr = citationsBlockMatch[1].trim();
              const parsed = JSON.parse(jsonStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                // Merge with our retrieved citations for completeness
                parsedCitations = citations;
              }
            } catch {
              // Use our pre-built citations if parsing fails
            }
          }

          // Send citations as a final SSE event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "citations", citations: parsedCitations })}\n\n`
            )
          );

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: "Stream error occurred" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(transformedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    const message = error instanceof Error ? error.message : "Chat failed";
    return new Response(
      `data: ${JSON.stringify({ type: "error", message })}\n\n`,
      {
        status: 200, // Keep 200 so SSE works; error type in payload
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }
}
