import "server-only";
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

// ─── Lazy client (avoids failing at build time without env vars) ──────────────

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to your .env.local or Vercel environment variables."
      );
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

// ─── Models ───────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const LLM_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";

// ─── Embedding Generation ─────────────────────────────────────────────────────

/**
 * Generate embeddings for an array of text strings.
 * Uses Gemini gemini-embedding-001 with 768 output dimensions.
 * Processes in batches of 20 to respect rate limits.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const embeddings: number[][] = [];

  const BATCH_SIZE = 20;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map((text) =>
        model.embedContent({
          content: { role: "user", parts: [{ text }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
          outputDimensionality: 768,
        } as any)
      )
    );

    for (const result of results) {
      embeddings.push(result.embedding.values);
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return embeddings;
}

/**
 * Generate a single query embedding optimized for retrieval queries.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: "user", parts: [{ text: query }] },
    taskType: TaskType.RETRIEVAL_QUERY,
    outputDimensionality: 768,
  } as any);
  return result.embedding.values;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemInstruction(context: string): string {
  return `You are a precise, professional AI assistant that answers questions EXCLUSIVELY based on the provided document context.

CONTEXT FROM UPLOADED DOCUMENTS:
${context}

CRITICAL RULES:
1. ONLY use information found in the context above to answer questions.
2. If the answer is not in the context, say: "I don't have enough information in the uploaded documents to answer this question."
3. NEVER fabricate facts, statistics, or details not present in the context.
4. Naturally cite sources inline where relevant (e.g., *(Unit 1.pdf, Page 8)* or *According to [filename], Page X*).
5. For follow-up questions, use the conversation history to understand context, but still ground answers strictly in the document context.
6. For comparison questions across multiple documents, clearly distinguish which document contains which information.
7. Be concise, well-structured, and professional. Use clean markdown formatting: clear headings, neat bulleted or numbered lists, and bold keywords.
8. Do NOT output raw JSON blocks or citation arrays at the end — our UI automatically displays interactive citations in a dedicated panel.`;
}

// ─── LLM Streaming ────────────────────────────────────────────────────────────

export interface ChatHistoryItem {
  role: "user" | "model";
  parts: { text: string }[];
}

/**
 * Stream a grounded RAG response from Gemini.
 * Returns a ReadableStream of text chunks.
 */
export async function streamRAGResponse(
  query: string,
  context: string,
  history: ChatHistoryItem[]
): Promise<ReadableStream<Uint8Array>> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: LLM_MODEL,
    systemInstruction: buildSystemInstruction(context),
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 2048,
    },
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(query);

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
