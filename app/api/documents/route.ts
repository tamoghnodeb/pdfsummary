import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listDocumentsForSession, deleteDocumentVectors } from "@/lib/pinecone";
import type { DocumentListResponse, DeleteDocumentRequest } from "@/types";

// ─── GET /api/documents?sessionId=xxx ─────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse<DocumentListResponse | { error: string }>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const documents = await listDocumentsForSession(sessionId);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("List documents error:", error);
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
  }
}

// ─── DELETE /api/documents ────────────────────────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse<{ success: boolean } | { error: string }>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DeleteDocumentRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { docHash, sessionId } = body;
  if (!docHash || !sessionId) {
    return NextResponse.json({ error: "docHash and sessionId are required" }, { status: 400 });
  }

  try {
    await deleteDocumentVectors(docHash, sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
