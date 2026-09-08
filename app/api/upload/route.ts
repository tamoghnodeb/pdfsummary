import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * Blob client-upload token handler.
 * The browser calls this to get a short-lived upload token,
 * then uploads the file directly to Vercel Blob (bypassing the
 * 4.5 MB Serverless Function body limit).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || "").trim().replace(/^"|"$/g, "");

  if (!token) {
    console.error("BLOB_READ_WRITE_TOKEN is missing or empty.");
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not configured on the server." },
      { status: 500 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname) => {
        return {
          maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("Blob upload completed:", blob.url, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Upload token generation failed:", error);
    const message = error instanceof Error ? error.message : "Upload token error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
