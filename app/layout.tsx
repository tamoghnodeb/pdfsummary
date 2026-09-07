import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocMind AI — RAG Chatbot",
  description:
    "Upload multiple PDF documents and have intelligent conversations powered by Retrieval-Augmented Generation. Get cited, grounded answers from your documents instantly.",
  keywords: ["RAG", "chatbot", "PDF", "AI", "document analysis", "Gemini"],
  authors: [{ name: "DocMind AI" }],
  openGraph: {
    title: "DocMind AI — Multi-PDF RAG Chatbot",
    description: "Ask questions across multiple PDFs with AI-powered answers and citations.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧠</text></svg>" />
      </head>
      <body>
        <SessionProvider session={session}>
          <div className="bg-orbs" aria-hidden="true">
            <div className="bg-orb bg-orb-1" />
            <div className="bg-orb bg-orb-2" />
            <div className="bg-orb bg-orb-3" />
          </div>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
