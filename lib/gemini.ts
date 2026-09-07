import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Singleton client ─────────────────────────────────────────────────────────

const apiKey = process.env.GEMINI_API_KEY!;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// ─── Embedding Model ──────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-004";
const LLM_MODEL = "gemini-2.0-flash";
const EMBEDDING_DIMENSION = 768;

/**
 * Generate embeddings for an array of text strings.
 * Uses Gemini text-embedding-004 (768 dimensions).
 * Processes in batches to respect rate limits.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const embeddings: number[][] = [];

  // Process in batches of 20 to avoid rate limiting
  const BATCH_SIZE = 20;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map((text) =>
        model.embedContent({
          content: { role: "user", parts: [{ text }] },
          taskType: "RETRIEVAL_DOCUMENT",
        })
      )
    );

    for (const result of results) {
      embeddings.push(result.embedding.values);
    }

    // Small delay between batches if more batches remain
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return embeddings;
}

/**
 * Generate a single query embedding (uses RETRIEVAL_QUERY task type
 * which is optimized for queries rather than documents).
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: "user", parts: [{ text: query }] },
    taskType: "RETRIEVAL_QUERY",
  });
  return result.embedding.values;
}

// ─── LLM Streaming ───────────────────────────────────────────────────────────

export interface ChatHistoryItem {
  role: "user" | "model";
  parts: { text: string }[];
}

/**
 * Build the system instruction for the RAG chatbot.
 * Enforces grounding and citation format.
 */
function buildSystemInstruction(context: string): string {
  return `You are a precise, helpful AI assistant that answers questions EXCLUSIVELY based on the provided document context.

CONTEXT FROM UPLOADED DOCUMENTS:
${context}

CRITICAL RULES:
1. ONLY use information found in the context above to answer questions.
2. If the answer is not in the context, say: "I don't have enough information in the uploaded documents to answer this question."
3. NEVER fabricate facts, statistics, or details not present in the context.
4. When referencing information, naturally mention the source (e.g., "According to [filename]..." or "As stated in [filename], page X...").
5. For follow-up questions, use the conversation history to understand context, but still ground answers in the document context.
6. For comparison questions across multiple documents, clearly distinguish which document contains which information.
7. Be concise but thorough. Use bullet points or numbered lists when appropriate.
8. Format your response in clean markdown.

At the END of your response, include a JSON block with citations in this EXACT format (no exceptions):
\`\`\`citations
[{"filename":"doc.pdf","page":1,"excerpt":"brief quote from chunk"}]
\`\`\`
Only include citations that actually support your response. If no information was found, use an empty array: []`;
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
  const model = genAI.getGenerativeModel({
    model: LLM_MODEL,
    systemInstruction: buildSystemInstruction(context),
    generationConfig: {
      temperature: 0.1, // Low temperature for factual grounding
      topP: 0.8,
      maxOutputTokens: 2048,
    },
  });

  const chat = model.startChat({
    history: history,
  });

  const result = await chat.sendMessageStream(query);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
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

  return stream;
}

export { EMBEDDING_DIMENSION };
