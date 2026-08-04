import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import {
  downloadStaffDocument,
  privatePdfResponse,
} from "@/server/documents/downloads.node";
import { createRuntimeDocumentStorage } from "@/server/documents/runtime.node";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const result = await downloadStaffDocument(
      await getActorSessionClaims(),
      { artifactId: documentId },
      db,
      createRuntimeDocumentStorage(),
    );
    if (!result.ok)
      return Response.json(
        { error: "The document is not available." },
        { status: result.reason === "UNAUTHENTICATED" ? 401 : 404 },
      );
    return privatePdfResponse(result.download);
  } catch {
    return Response.json(
      { error: "The document is not available." },
      { status: 503 },
    );
  }
}
