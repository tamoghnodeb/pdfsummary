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
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/></svg>" />
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
