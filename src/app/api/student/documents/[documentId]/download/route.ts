import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import {
  downloadStudentDocument,
  privatePdfResponse,
} from "@/server/documents/downloads.node";
import { createRuntimeDocumentStorage } from "@/server/documents/runtime.node";
import {
  createRequestId,
  logOperationalEvent,
} from "@/server/observability/logger.node";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const result = await downloadStudentDocument(
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
    logOperationalEvent({
      event: "document.download.unavailable",
      level: "warn",
      metadata: { operation: "student-download", result: "unavailable" },
      requestId: createRequestId(),
    });
    return Response.json(
      { error: "The document is not available." },
      { status: 503 },
    );
  }
}
