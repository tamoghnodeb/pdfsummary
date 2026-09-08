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
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Allow only PDF files up to 50 MB
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called by Vercel webhook after upload finishes.
        // Note: does NOT fire during local dev (no public URL).
        console.log("Blob upload completed:", blob.url, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload token error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
