# DocMind AI

A full-stack **Retrieval-Augmented Generation (RAG) chatbot** built with Next.js. Upload PDF documents and ask natural-language questions — powered by Google Gemini embeddings, Pinecone vector search, and streaming responses with source citations.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tamoghnodeb/pdfsummary)

---

## Features

| Feature | Details |
|:---|:---|
| **Multi-PDF Upload** | Up to 50 PDFs per session via drag-and-drop |
| **Semantic Search** | Gemini `gemini-embedding-001` (768-dim) + Pinecone vector search |
| **Grounded Answers** | Gemini 2.5 Flash — answers strictly from your documents |
| **Source Citations** | Every answer includes filename and page number |
| **Streaming** | Token-by-token output via Server-Sent Events |
| **Deduplication** | SHA-256 hash check — never re-embeds the same file twice |
| **Conversation Memory** | Follow-up questions retain context from the session |
| **Auth** | Password-protected access via NextAuth.js |
| **Responsive UI** | Dark glassmorphism design — works on desktop and mobile |

---

## Architecture

```
                          ┌───────────────────────────────┐
                          │        Next.js 16 (Vercel)    │
                          │                               │
                          │  /login   /chat   /api/*      │
                          └──────────────┬────────────────┘
                                         │
               ┌─────────────────────────┼─────────────────────────┐
               ▼                         ▼                         ▼
  ┌────────────────────┐    ┌─────────────────────┐    ┌───────────────────┐
  │   Google Gemini    │    │  Pinecone Serverless │    │   Browser Client  │
  │                    │    │                     │    │                   │
  │  gemini-embedding  │    │  768-dim cosine      │    │  React + SSE      │
  │  -001 (embeddings) │    │  vector index        │    │  streaming reader │
  │                    │    │  + metadata filters  │    │                   │
  │  gemini-2.5-flash  │    │  (session isolation) │    │  Citation panel   │
  │  (chat + stream)   │    │                     │    │  Document sidebar  │
  └────────────────────┘    └─────────────────────┘    └───────────────────┘
```

**Upload flow:**
```
Browser → POST /api/upload (base64) → /api/process →
  pdfjs-dist (text extraction) → chunk → Gemini embed → Pinecone upsert
```

**Query flow:**
```
User query → Gemini embed query → Pinecone top-5 → context string →
  Gemini 2.5 Flash stream → SSE to browser → citations rendered
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Accounts at [Google AI Studio](https://aistudio.google.com), [Pinecone](https://app.pinecone.io)

### 1. Clone & install

```bash
git clone https://github.com/tamoghnodeb/pdfsummary.git
cd pdfsummary
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your keys (see [Environment Variables](#environment-variables) below).

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your `APP_PASSWORD`.

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "initial commit"
git branch -M main
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your repository
2. Under **Environment Variables**, add every key from `.env.example`
3. Set `NEXTAUTH_URL` to your Vercel deployment URL (e.g. `https://your-project.vercel.app`)
4. Click **Deploy**

> **Common issue:** The server error on first deploy is almost always missing environment variables. Make sure all keys from `.env.example` are added in Vercel → Project Settings → Environment Variables.

---

## Environment Variables

| Variable | Description | Required |
|:---|:---|:---:|
| `GEMINI_API_KEY` | Google AI Studio API key | ✓ |
| `PINECONE_API_KEY` | Pinecone API key | ✓ |
| `PINECONE_INDEX_NAME` | Name of your Pinecone index | ✓ |
| `NEXTAUTH_SECRET` | Random secret for JWT signing (`openssl rand -base64 32`) | ✓ |
| `NEXTAUTH_URL` | Full URL of your deployment — `http://localhost:3000` for local dev, your Vercel URL in production | ✓ |
| `APP_PASSWORD` | Password users enter to access the app | ✓ |

### Setting up services

<details>
<summary><strong>Google Gemini</strong> (free)</summary>

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API key**
3. Copy the key into `GEMINI_API_KEY`

</details>

<details>
<summary><strong>Pinecone</strong> (free tier available)</summary>

1. Sign up at [app.pinecone.io](https://app.pinecone.io)
2. Create a new **Serverless** index:
   - **Dimensions:** `768`
   - **Metric:** `cosine`
   - **Cloud:** AWS · **Region:** us-east-1
3. Copy your API key into `PINECONE_API_KEY`
4. Set `PINECONE_INDEX_NAME` to your index name

</details>

---

## Project Structure

```
pdfsummary/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth.js handler
│   │   ├── upload/               # PDF ingestion endpoint
│   │   ├── process/              # Text extraction → embed → Pinecone
│   │   ├── chat/                 # SSE streaming RAG endpoint
│   │   └── documents/            # List / delete indexed documents
│   ├── chat/page.tsx             # Protected chat interface
│   ├── login/page.tsx            # Login page
│   ├── layout.tsx                # Root layout + SessionProvider
│   └── globals.css               # Design system (glassmorphism)
├── components/
│   ├── ChatInterface.tsx          # Main orchestrator component
│   ├── DocumentSidebar.tsx        # Upload zone + document list
│   ├── MessageBubble.tsx          # Chat message renderer
│   ├── CitationPanel.tsx          # Source citation display
│   └── SessionProvider.tsx        # NextAuth client wrapper
├── lib/
│   ├── gemini.ts                  # Gemini embeddings + chat
│   ├── pinecone.ts                # Vector DB read/write
│   ├── pdf-processor.ts           # PDF text extraction + chunking
│   ├── auth.ts                    # NextAuth config
│   └── utils.ts                   # Shared utilities
├── types/index.ts                 # TypeScript type definitions
└── .env.example                   # Environment variable template
```

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| LLM | Google Gemini 2.5 Flash |
| Embeddings | Gemini `gemini-embedding-001` (768-dim) |
| Vector DB | Pinecone Serverless |
| PDF Parsing | pdfjs-dist (server-side) |
| Auth | NextAuth.js v4 (Credentials provider) |
| Styling | Vanilla CSS — dark glassmorphism |
| Deployment | Vercel |

---

## License

MIT — free for personal and educational use.
