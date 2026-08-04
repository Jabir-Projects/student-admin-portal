import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { documentListQuerySchema } from "@/features/documents/schemas";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import { loadAnyCapabilityActor } from "@/server/documents/authorization.node";
import { authorizeStudentActor } from "@/server/student-portal/authorization.node";

const staffDocumentCapabilities = [
  "GENERATE_DOCUMENTS",
  "RELEASE_DOCUMENTS",
  "REVOKE_DOCUMENTS",
] as const;

export async function listStaffDocuments(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
) {
  const parsed = documentListQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" } as const;
  const authorization = await loadAnyCapabilityActor(
    claims,
    staffDocumentCapabilities,
    database,
  );
  if (!authorization.ok) return authorization;
  const skip = (parsed.data.page - 1) * 25;
  const [eligibleRequests, artifacts, totalArtifacts] = await Promise.all([
    database.documentRequest.findMany({
      where: { status: "READY" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 25,
      select: {
        id: true,
        referenceNumber: true,
        deliveryMethod: true,
        category: { select: { name: true } },
        student: {
          select: {
            studentNumber: true,
            user: { select: { fullName: true } },
          },
        },
      },
    }),
    database.documentArtifact.findMany({
      orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
      skip,
      take: 25,
      select: {
        id: true,
        requestId: true,
        type: true,
        status: true,
        version: true,
        filename: true,
        byteSize: true,
        generatedAt: true,
        releasedAt: true,
        revokedAt: true,
        request: {
          select: {
            referenceNumber: true,
            deliveryMethod: true,
            category: { select: { name: true } },
          },
        },
      },
    }),
    database.documentArtifact.count(),
  ]);
  return {
    ok: true as const,
    actor: authorization.actor,
    eligibleRequests,
    artifacts,
    page: parsed.data.page,
    pageCount: Math.max(1, Math.ceil(totalArtifacts / 25)),
  };
}

export async function listStudentDocuments(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
) {
  const parsed = documentListQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" } as const;
  const authorization = await authorizeStudentActor(claims, database);
  if (!authorization.ok) return authorization;
  const where: Prisma.DocumentArtifactWhereInput = {
    request: {
      studentId: authorization.actor.profileId,
      deliveryMethod: "DIGITAL_DELIVERY" as const,
    },
    status: { in: ["RELEASED", "REVOKED"] },
  };
  const [total, artifacts] = await Promise.all([
    database.documentArtifact.count({ where }),
    database.documentArtifact.findMany({
      where,
      orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
      skip: (parsed.data.page - 1) * 20,
      take: 20,
      select: {
        id: true,
        requestId: true,
        type: true,
        status: true,
        version: true,
        generatedAt: true,
        releasedAt: true,
        revokedAt: true,
        request: {
          select: {
            referenceNumber: true,
            category: { select: { name: true } },
          },
        },
      },
    }),
  ]);
  return {
    ok: true as const,
    artifacts,
    page: parsed.data.page,
    pageCount: Math.max(1, Math.ceil(total / 20)),
  };
}

export async function getStudentDocumentDetails(
  claims: ActorSessionClaims,
  artifactId: string,
  database: PrismaClient,
) {
  const authorization = await authorizeStudentActor(claims, database);
  if (!authorization.ok) return authorization;
  const artifact = await database.documentArtifact.findFirst({
    where: {
      id: artifactId,
      status: { in: ["RELEASED", "REVOKED"] },
      request: {
        studentId: authorization.actor.profileId,
        deliveryMethod: "DIGITAL_DELIVERY",
      },
    },
    select: {
      id: true,
      requestId: true,
      type: true,
      status: true,
      version: true,
      generatedAt: true,
      releasedAt: true,
      revokedAt: true,
      request: {
        select: {
          referenceNumber: true,
          category: { select: { name: true } },
        },
      },
    },
  });
  return { ok: true as const, artifact };
}
