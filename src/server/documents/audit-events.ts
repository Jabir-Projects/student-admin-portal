import type { DocumentArtifactStatus } from "@/generated/prisma/client";

export function documentAuditEvent(input: {
  actorId: string | null;
  action: string;
  artifactId?: string;
  requestId?: string;
  version?: number;
  status?: DocumentArtifactStatus;
  reasonCode?: string;
  byteSize?: number;
}) {
  return {
    actorId: input.actorId,
    action: input.action,
    entityType: "DocumentArtifact",
    entityId: input.artifactId ?? null,
    metadata: {
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.version ? { version: input.version } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      ...(input.byteSize ? { byteSize: input.byteSize } : {}),
      documentType: "REQUEST_FULFILMENT_CONFIRMATION",
    },
  } as const;
}
