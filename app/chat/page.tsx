import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ChatInterface from "@/components/ChatInterface";

export const metadata = {
  title: "DocMind AI — Chat",
  description: "Chat with your uploaded PDF documents using AI-powered RAG",
};

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return <ChatInterface />;
}
