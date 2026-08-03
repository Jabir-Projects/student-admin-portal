import type { Prisma } from "@/generated/prisma/client";

export type RegistryImportAuditAction =
  | "REGISTRY_IMPORT_UPLOADED"
  | "REGISTRY_IMPORT_VALIDATED"
  | "REGISTRY_IMPORT_SUBMITTED"
  | "REGISTRY_IMPORT_APPROVED"
  | "REGISTRY_IMPORT_REJECTED"
  | "REGISTRY_IMPORT_STAGING_PURGED";

export function registryImportAuditEvent(input: {
  actorId: string | null;
  action: RegistryImportAuditAction;
  batchId: string;
  metadata: Prisma.InputJsonObject;
}) {
  return {
    actorId: input.actorId,
    action: input.action,
    entityType: "ImportBatch",
    entityId: input.batchId,
    metadata: input.metadata,
  } as const;
}
