import "server-only";

import { Buffer } from "node:buffer";

import type { PrismaClient } from "@/generated/prisma/client";
import { artifactActionInputSchema } from "@/features/documents/schemas";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import { documentAuditEvent } from "@/server/documents/audit-events";
import { loadAnyCapabilityActor } from "@/server/documents/authorization.node";
import {
  checksumDocument,
  type DocumentStorage,
} from "@/server/documents/storage.node";
import { authorizeStudentActor } from "@/server/student-portal/authorization.node";

export type DocumentDownload = Readonly<{
  bytes: Uint8Array;
  filename: string;
  byteSize: number;
}>;

async function loadVerifiedBytes(
  artifact: {
    storageKey: string;
    checksum: string;
    byteSize: number;
    filename: string;
  },
  storage: DocumentStorage,
): Promise<DocumentDownload | null> {
  const stored = await storage.get(artifact.storageKey);
  if (
    !stored ||
    stored.size !== artifact.byteSize ||
    checksumDocument(stored.body) !== artifact.checksum
  )
    return null;
  return {
    bytes: stored.body,
    filename: artifact.filename,
    byteSize: artifact.byteSize,
  };
}

export async function downloadStudentDocument(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
  storage: DocumentStorage,
) {
  const parsed = artifactActionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "NOT_FOUND" } as const;
  const authorization = await authorizeStudentActor(claims, database);
  if (!authorization.ok) return authorization;
  const artifact = await database.documentArtifact.findFirst({
    where: {
      id: parsed.data.artifactId,
      status: "RELEASED",
      request: {
        studentId: authorization.actor.profileId,
        deliveryMethod: "DIGITAL_DELIVERY",
      },
    },
    select: {
      id: true,
      requestId: true,
      version: true,
      status: true,
      storageKey: true,
      checksum: true,
      byteSize: true,
      filename: true,
    },
  });
  if (!artifact) {
    await database.auditLog.create({
      data: documentAuditEvent({
        actorId: authorization.actor.id,
        action: "DOCUMENT_ACCESS_DENIED",
        reasonCode: "NOT_AVAILABLE",
      }),
    });
    return { ok: false, reason: "NOT_FOUND" } as const;
  }
  const download = await loadVerifiedBytes(artifact, storage);
  if (!download) return { ok: false, reason: "NOT_FOUND" } as const;
  await database.auditLog.create({
    data: documentAuditEvent({
      actorId: authorization.actor.id,
      action: "DOCUMENT_DOWNLOADED",
      artifactId: artifact.id,
      requestId: artifact.requestId,
      version: artifact.version,
      status: artifact.status,
      byteSize: artifact.byteSize,
    }),
  });
  return { ok: true as const, download };
}

export async function downloadStaffDocument(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
  storage: DocumentStorage,
) {
  const parsed = artifactActionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "NOT_FOUND" } as const;
  const authorization = await loadAnyCapabilityActor(
    claims,
    ["GENERATE_DOCUMENTS", "RELEASE_DOCUMENTS"],
    database,
  );
  if (!authorization.ok) return authorization;
  const artifact = await database.documentArtifact.findUnique({
    where: { id: parsed.data.artifactId },
    select: {
      id: true,
      requestId: true,
      version: true,
      status: true,
      storageKey: true,
      checksum: true,
      byteSize: true,
      filename: true,
    },
  });
  if (!artifact) return { ok: false, reason: "NOT_FOUND" } as const;
  const download = await loadVerifiedBytes(artifact, storage);
  if (!download) return { ok: false, reason: "NOT_FOUND" } as const;
  await database.auditLog.create({
    data: documentAuditEvent({
      actorId: authorization.actor.id,
      action: "DOCUMENT_DOWNLOADED",
      artifactId: artifact.id,
      requestId: artifact.requestId,
      version: artifact.version,
      status: artifact.status,
      byteSize: artifact.byteSize,
    }),
  });
  return { ok: true as const, download };
}

export function privatePdfResponse(download: DocumentDownload) {
  const filename = download.filename.replace(/[^A-Za-z0-9._-]/gu, "_");
  return new Response(Buffer.from(download.bytes), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(download.byteSize),
      "Content-Type": "application/pdf",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, noarchive",
    },
  });
}
