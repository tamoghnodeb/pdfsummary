# DocMind AI 

A production-grade **Retrieval-Augmented Generation (RAG) chatbot** that lets you upload up to 50 PDF documents and ask natural-language questions across them — with grounded, cited answers powered by Google Gemini.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

##  Features

| Feature | Details |
|:---|:---|
|  **Multi-PDF Upload** | Up to 50 PDFs per session, drag-and-drop |
|  **Semantic Search** | Gemini `text-embedding-004` (768-dim) + Pinecone |
|  **Grounded Answers** | Gemini 2.0 Flash — never hallucinator, cites sources |
|  **Citations** | Filename + page number for every answer |
|  **Streaming** | Token-by-token streaming via SSE |
| ️ **Deduplication** | SHA-256 hash — skip re-embedding unchanged files |
| ️ **Conversation Memory** | Follow-up questions with context |
|  **Auth** | Password gate via NextAuth.js |
|  **Responsive** | Mobile-friendly dark glassmorphism UI |

---

## ️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel Platform                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js 14 App (App Router)             │   │
│  │                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │   │
│  │  │  Login   │  │  Chat    │  │  API Routes        │  │   │
│  │  │  Page    │  │  Page    │  │  /upload /process  │  │   │
│  │  │          │  │          │  │  /chat  /documents │  │   │
│  │  └──────────┘  └──────────┘  └───────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────┐                                   │
│  │    Vercel Blob        │  ← PDF file storage              │
│  └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
          │                           │
          ▼                           ▼
┌──────────────────┐       ┌──────────────────────┐
│  Google Gemini   │       │   Pinecone Serverless │
│                  │       │                      │
│ text-embedding   │       │  768-dim cosine index │
│ 004 (embeddings) │       │  + metadata filters  │
│                  │       │                      │
│ gemini-2.0-flash │       │  sessionId isolation │
│ (LLM + stream)   │       │  per-user sessions   │
└──────────────────┘       └──────────────────────┘
```

### Data Flow

**Upload Flow:**
```
User → Vercel Blob (direct) → /api/process → pdf-parse → chunk →
Gemini embeddings → Pinecone upsert
```

**Query Flow:**
```
User query → Gemini embed query → Pinecone Top-5 search →
Context string → Gemini stream → SSE to browser → Citations rendered
```

---

##  Quick Start (Local)

### Prerequisites
- Node.js 18+
- Accounts at: [Google AI Studio](https://aistudio.google.com), [Pinecone](https://app.pinecone.io), [Vercel](https://vercel.com)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd aarush
npm install
```

### 2. Set Up Services

#### Google Gemini (Free)
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API Key** → Create API Key
3. Copy the key

#### Pinecone (Free)
1. Sign up at [app.pinecone.io](https://app.pinecone.io)
2. Create a new **Serverless** index:
   - **Name:** `rag-chatbot`
   - **Dimensions:** `768`
   - **Metric:** `cosine`
   - **Cloud/Region:** AWS / us-east-1
3. Copy your API key from the dashboard

#### Vercel Blob (for local dev)
```bash
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```bash
GEMINI_API_KEY=your_actual_key
PINECONE_API_KEY=your_actual_key
PINECONE_INDEX_NAME=rag-chatbot
BLOB_READ_WRITE_TOKEN=your_blob_token
NEXTAUTH_SECRET=run_openssl_rand_base64_32
NEXTAUTH_URL=http://localhost:3000
APP_PASSWORD=your_chosen_password
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your `APP_PASSWORD`.

---

## ️ Deploy to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "feat: RAG chatbot"
git push origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Under **Storage** → Add **Blob** store
4. Add all environment variables (see `.env.example`)
5. Set `NEXTAUTH_URL` to your Vercel deployment URL

### 3. Deploy

Vercel auto-deploys on every push to `main`.

> **Important:** After deploy, update `NEXTAUTH_URL` to your actual Vercel URL.

---

##  Project Structure

```
aarush/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth handler
│   │   ├── upload/               # Vercel Blob upload
│   │   ├── process/              # PDF → embed → Pinecone
│   │   ├── chat/                 # SSE streaming RAG
│   │   └── documents/            # List / delete docs
│   ├── chat/page.tsx             # Protected chat page
│   ├── login/page.tsx            # Login page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Design system
├── components/
│   ├── ChatInterface.tsx         # Main orchestrator
│   ├── DocumentSidebar.tsx       # PDF upload + list
│   ├── MessageBubble.tsx         # Chat messages
│   ├── CitationPanel.tsx         # Source citations
│   ├── LoadingDots.tsx           # Animated loader
│   └── SessionProvider.tsx       # NextAuth wrapper
├── lib/
│   ├── gemini.ts                 # Gemini LLM + embeddings
│   ├── pinecone.ts               # Vector DB operations
│   ├── pdf-processor.ts          # Text extraction + chunking
│   ├── auth.ts                   # NextAuth config
│   └── utils.ts                  # Helpers
└── types/index.ts                # Shared TypeScript types
```

---

## ️ Configuration

| Variable | Description | Default |
|:---|:---|:---|
| `GEMINI_API_KEY` | Google AI Studio API key | — |
| `PINECONE_API_KEY` | Pinecone API key | — |
| `PINECONE_INDEX_NAME` | Pinecone index name | `rag-chatbot` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token | — |
| `NEXTAUTH_SECRET` | NextAuth JWT secret | — |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` |
| `APP_PASSWORD` | Access password | `docmind-demo-2024` |

---

##  Testing

### Manual Test Checklist

- [ ] Login with correct/incorrect password
- [ ] Upload 1 PDF → see processing success
- [ ] Upload same PDF again → "Already indexed" (no re-embedding)
- [ ] Upload corrupted file → graceful error message
- [ ] Ask single-document question → correct answer + citation
- [ ] Ask cross-document question → synthesized answer from both sources
- [ ] Ask follow-up question → context maintained
- [ ] Ask unanswerable question → "I don't have that information" response
- [ ] Delete document → no longer cited in future answers
- [ ] Verify streaming — tokens appear live
- [ ] Test on mobile viewport

### RAG Evaluation (Manual)

Sample questions to evaluate with 3 different PDFs:

| Test | Expected |
|:---|:---|
| "What is the main topic of [doc1]?" | Correct topic with citation |
| "Compare the approach in [doc1] vs [doc2]" | Cross-doc synthesis |
| "What year was this published?" | Page number + year |
| "Tell me about quantum computing" (unrelated) | "Not in documents" response |
| "What did you say earlier about X?" | Context-aware follow-up |

---

## ️ Tech Stack

| Component | Technology |
|:---|:---|
| Framework | Next.js 14 (App Router) |
| LLM | Google Gemini 2.0 Flash |
| Embeddings | Gemini text-embedding-004 (768-dim) |
| Vector DB | Pinecone Serverless |
| PDF Storage | Vercel Blob |
| PDF Parsing | pdf-parse |
| Auth | NextAuth.js (Credentials) |
| Styling | Vanilla CSS (Glassmorphism) |
| Deployment | Vercel |

---

##  Performance

- **PDF Processing**: ~1–3s per 20-page document (network dependent)
- **Query Latency**: < 2s first token (embedding + Pinecone + Gemini)
- **Deduplication**: Duplicate PDFs are skipped instantly (hash check)
- **Streaming**: Tokens rendered in real-time, no wait for full response
- **No Re-embedding**: Pinecone persistence means embeddings survive restarts

---

##  License

MIT License — free for personal and educational use.

---

*Built with ️ for RAG demonstration purposes.*
