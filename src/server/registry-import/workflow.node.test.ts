// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import type { CapabilityValue } from "@/features/auth/constants";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import {
  loadCapabilityActor,
  revalidateCapabilityActorInTransaction,
} from "@/server/auth/capabilities.node";
import { parseRegistryImport } from "@/server/registry-import/parser.node";
import {
  approveRegistryImportAsActor,
  purgeExpiredRegistryImportStaging,
  rejectRegistryImportAsActor,
  submitRegistryImportAsActor,
  uploadRegistryImportAsActor,
  type RegistryImportWorkflowResult,
} from "@/server/registry-import/workflow.node";

vi.mock("@/server/auth/capabilities.node", () => ({
  loadCapabilityActor: vi.fn(),
  revalidateCapabilityActorInTransaction: vi.fn(),
}));

vi.mock("@/server/registry-import/parser.node", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/server/registry-import/parser.node")
    >();
  return { ...original, parseRegistryImport: vi.fn() };
});

const loadActor = vi.mocked(loadCapabilityActor);
const revalidateActor = vi.mocked(revalidateCapabilityActorInTransaction);
const parseImport = vi.mocked(parseRegistryImport);
const actorId = "a8100000-0000-4000-8000-000000000001";
const reviewerId = "a8100000-0000-4000-8000-000000000002";
const batchId = "a8100000-0000-4000-8000-000000000003";
const claims = { actorId, claimedSessionVersion: 0 } as const;
const reviewerClaims = {
  actorId: reviewerId,
  claimedSessionVersion: 0,
} as const;

const parsedImport = {
  checksum: "a".repeat(64),
  originalFilename: "registry.csv",
  originalByteSize: 128,
  sourceType: "CSV" as const,
  rows: [
    {
      rowNumber: 2,
      value: {
        studentNumber: "V28-UNIT-1",
        fullName: "Unit Student",
        normalizedFullName: "unit student",
        email: "v28-unit-1@example.test",
        program: "BAC+3 Software Engineering" as const,
        academicYear: "YEAR_1" as const,
        status: "ACTIVE" as const,
      },
      errors: [],
    },
  ],
  totalRows: 1,
  validRows: 1,
  invalidRows: 0,
};

function authorized(id: string, capabilities: readonly CapabilityValue[]) {
  return {
    ok: true as const,
    actor: {
      id,
      role: "STAFF" as const,
      status: "ACTIVE" as const,
      sessionVersion: 0,
      capabilities,
    },
  };
}

type ReviewOperation = (
  actorClaims: ActorSessionClaims,
  id: string,
  database: PrismaClient,
) => Promise<RegistryImportWorkflowResult>;

const rejectOperation: ReviewOperation = (actorClaims, id, database) =>
  rejectRegistryImportAsActor(
    actorClaims,
    { batchId: id, reason: "Independent reason" },
    database,
  );

function denied(reason = "MISSING_CAPABILITY" as const) {
  return { ok: false as const, reason };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadActor.mockResolvedValue(denied());
  revalidateActor.mockResolvedValue(denied());
  parseImport.mockResolvedValue(parsedImport);
});

describe("V2-8 registry import workflow authorization", () => {
  it("requires upload capability before parsing or writing", async () => {
    const transaction = vi.fn();
    const database = { $transaction: transaction } as unknown as PrismaClient;

    await expect(
      uploadRegistryImportAsActor(
        claims,
        {
          bytes: new Uint8Array([1]),
          filename: "registry.csv",
          mimeType: "text/csv",
        },
        database,
      ),
    ).resolves.toEqual(denied());

    expect(loadActor).toHaveBeenCalledWith(
      claims,
      "REGISTRY_IMPORT_UPLOAD",
      database,
    );
    expect(parseImport).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("revalidates upload capability in the write transaction", async () => {
    loadActor.mockResolvedValue(
      authorized(actorId, ["REGISTRY_IMPORT_UPLOAD"]),
    );
    const create = vi.fn();
    const transaction = { importBatch: { create } };
    const database = {
      studentRegistry: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((callback) => callback(transaction)),
    } as unknown as PrismaClient;

    await expect(
      uploadRegistryImportAsActor(
        claims,
        {
          bytes: new Uint8Array([1]),
          filename: "registry.csv",
          mimeType: "text/csv",
        },
        database,
      ),
    ).resolves.toEqual(denied());

    expect(revalidateActor).toHaveBeenCalledWith(
      transaction,
      claims,
      "REGISTRY_IMPORT_UPLOAD",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ["approve", approveRegistryImportAsActor as ReviewOperation],
    ["reject", rejectOperation],
  ] as const)(
    "requires approval capability for %s before locking",
    async (_name, operation) => {
      const queryRaw = vi.fn();
      const transaction = { $queryRaw: queryRaw };
      const database = {
        $transaction: vi.fn((callback) => callback(transaction)),
      } as unknown as PrismaClient;

      await expect(
        operation(reviewerClaims, batchId, database),
      ).resolves.toEqual(denied());
      expect(revalidateActor).toHaveBeenCalledWith(
        transaction,
        reviewerClaims,
        "REGISTRY_IMPORT_APPROVE",
      );
      expect(queryRaw).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["approval", approveRegistryImportAsActor as ReviewOperation],
    ["rejection", rejectOperation],
  ] as const)(
    "enforces four-eyes control inside the %s transaction",
    async (_name, operation) => {
      revalidateActor.mockResolvedValue(
        authorized(actorId, [
          "REGISTRY_IMPORT_UPLOAD",
          "REGISTRY_IMPORT_APPROVE",
        ]),
      );
      const update = vi.fn();
      const transaction = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        importBatch: {
          findUnique: vi.fn().mockResolvedValue({
            id: batchId,
            uploaderId: actorId,
            status: "PENDING_APPROVAL",
            purgedAt: null,
          }),
          update,
        },
      };
      const database = {
        $transaction: vi.fn((callback) => callback(transaction)),
      } as unknown as PrismaClient;

      await expect(operation(claims, batchId, database)).resolves.toEqual({
        ok: false,
        reason: "SELF_REVIEW",
      });
      expect(update).not.toHaveBeenCalled();
    },
  );
});

describe("V2-8 registry import lifecycle guards", () => {
  it("submits only a fully valid, owned VALIDATED batch", async () => {
    revalidateActor.mockResolvedValue(
      authorized(actorId, ["REGISTRY_IMPORT_UPLOAD"]),
    );
    const update = vi.fn().mockResolvedValue({});
    const auditCreate = vi.fn().mockResolvedValue({});
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      importBatch: {
        findUnique: vi.fn().mockResolvedValue({
          id: batchId,
          uploaderId: actorId,
          status: "VALIDATED",
          purgedAt: null,
          totalRows: 1,
          validRows: 1,
          invalidRows: 0,
        }),
        update,
      },
      registryImportRow: { count: vi.fn().mockResolvedValue(1) },
      auditLog: { create: auditCreate },
    };
    const database = {
      $transaction: vi.fn((callback) => callback(transaction)),
    } as unknown as PrismaClient;

    await expect(
      submitRegistryImportAsActor(claims, batchId, database),
    ).resolves.toEqual({
      ok: true,
      status: "PENDING_APPROVAL",
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: batchId },
      data: expect.objectContaining({ status: "PENDING_APPROVAL" }),
    });
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects forged valid counts when staged rows do not match", async () => {
    revalidateActor.mockResolvedValue(
      authorized(actorId, ["REGISTRY_IMPORT_UPLOAD"]),
    );
    const update = vi.fn();
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      importBatch: {
        findUnique: vi.fn().mockResolvedValue({
          id: batchId,
          uploaderId: actorId,
          status: "VALIDATED",
          purgedAt: null,
          totalRows: 2,
          validRows: 2,
          invalidRows: 0,
        }),
        update,
      },
      registryImportRow: { count: vi.fn().mockResolvedValue(1) },
    };
    const database = {
      $transaction: vi.fn((callback) => callback(transaction)),
    } as unknown as PrismaClient;

    await expect(
      submitRegistryImportAsActor(claims, batchId, database),
    ).resolves.toEqual({
      ok: false,
      reason: "INVALID_BATCH",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("selects only bounded expired non-approved batches and is idempotent", async () => {
    const now = new Date("2026-08-03T12:00:00.000Z");
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const database = { importBatch: { findMany } } as unknown as PrismaClient;

    await expect(
      purgeExpiredRegistryImportStaging(database, now, 10_000),
    ).resolves.toEqual({
      purged: 0,
    });
    await expect(
      purgeExpiredRegistryImportStaging(database, now, 10_000),
    ).resolves.toEqual({
      purged: 0,
    });
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenLastCalledWith({
      where: {
        expiresAt: { lte: now },
        purgedAt: null,
        status: { in: ["UPLOADED", "VALIDATED", "REJECTED", "FAILED"] },
      },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: 100,
      select: { id: true },
    });
  });
});
