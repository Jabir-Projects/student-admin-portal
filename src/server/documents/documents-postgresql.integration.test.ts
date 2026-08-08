// @vitest-environment node

import { randomUUID } from "node:crypto";

import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  downloadStaffDocument,
  downloadStudentDocument,
} from "@/server/documents/downloads.node";
import {
  cleanupOrphanDocuments,
  generateDocumentAsActor,
  releaseDocumentAsActor,
  revokeDocumentAsActor,
} from "@/server/documents/mutations.node";
import {
  getStudentDocumentDetails,
  listStaffDocuments,
} from "@/server/documents/reads.node";
import {
  InMemoryDocumentStorage,
  checksumDocument,
} from "@/server/documents/storage.node";
import {
  openVerifiedIsolatedTestDatabase,
  type VerifiedIsolatedTestDatabase,
} from "@/test/isolated-database.node";

dotenv.config({ path: ".env.local", quiet: true });

const ids = {
  generate: randomUUID(),
  release: randomUUID(),
  revoke: randomUUID(),
  all: randomUUID(),
  zero: randomUUID(),
  disabled: randomUUID(),
  studentA: randomUUID(),
  studentB: randomUUID(),
  profileA: randomUUID(),
  profileB: randomUUID(),
  category: randomUUID(),
} as const;

const claims = (actorId: string, claimedSessionVersion = 0) => ({
  actorId,
  claimedSessionVersion,
});
const storage = new InMemoryDocumentStorage();
let lastGenerationFailure:
  { name: string; code?: string; constraint?: string } | undefined;
let verified: VerifiedIsolatedTestDatabase;
let db: PrismaClient;

async function fakePdf(input: { referenceNumber: string; version: number }) {
  const bytes = new TextEncoder().encode(
    `%PDF-1.7\n${input.referenceNumber}-v${input.version}`,
  );
  return {
    bytes,
    checksum: checksumDocument(bytes),
    filename: `sist-request-${input.referenceNumber}-v${input.version}.pdf`,
  };
}

async function createRequest(
  deliveryMethod: "DIGITAL_DELIVERY" | "CAMPUS_PICKUP" = "DIGITAL_DELIVERY",
) {
  return db.documentRequest.create({
    data: {
      studentId: ids.profileA,
      categoryId: ids.category,
      status: "READY",
      deliveryMethod,
      copyCount: 1,
    },
  });
}

async function generate(requestId: string, actorId = ids.all) {
  lastGenerationFailure = undefined;
  return generateDocumentAsActor(claims(actorId), { requestId }, db, {
    storage,
    generatePdf: fakePdf as never,
    onFailure: (error) => {
      const value = error as {
        code?: unknown;
        meta?: {
          driverAdapterError?: {
            cause?: { originalCode?: unknown; originalMessage?: unknown };
          };
        };
      };
      const message = value.meta?.driverAdapterError?.cause?.originalMessage;
      const constraint =
        typeof message === "string"
          ? message.match(/constraint "([A-Za-z0-9_]+)"/u)?.[1]
          : undefined;
      lastGenerationFailure = {
        name: error instanceof Error ? error.constructor.name : typeof error,
        code: [value.code, value.meta?.driverAdapterError?.cause?.originalCode]
          .filter(Boolean)
          .join("/"),
        constraint,
      };
    },
  });
}

beforeAll(async () => {
  verified = await openVerifiedIsolatedTestDatabase(process.env);
  db = verified.database;
  await db.user.createMany({
    data: [
      {
        id: ids.generate,
        label: "generate",
        fullName: "V2-9 Generate",
        status: "ACTIVE" as const,
      },
      {
        id: ids.release,
        label: "release",
        fullName: "V2-9 Release",
        status: "ACTIVE" as const,
      },
      {
        id: ids.revoke,
        label: "revoke",
        fullName: "V2-9 Revoke",
        status: "ACTIVE" as const,
      },
      {
        id: ids.all,
        label: "all",
        fullName: "V2-9 All",
        status: "ACTIVE" as const,
      },
      {
        id: ids.zero,
        label: "zero",
        fullName: "V2-9 Zero",
        status: "ACTIVE" as const,
      },
      {
        id: ids.disabled,
        label: "disabled",
        fullName: "V2-9 Disabled",
        status: "DISABLED" as const,
      },
    ].map((user) => ({
      id: user.id,
      email: `v2-9-${user.label}-${user.id}@example.test`,
      fullName: user.fullName,
      passwordHash: "not-used-by-v2-9-tests",
      role: "STAFF" as const,
      status: user.status,
      ...(user.status === "DISABLED"
        ? { disabledAt: new Date(), disabledById: ids.all }
        : {}),
    })),
  });
  await db.user.createMany({
    data: [
      { id: ids.studentA, label: "student-a", fullName: "Student A" },
      { id: ids.studentB, label: "student-b", fullName: "Student B" },
    ].map((user) => ({
      id: user.id,
      email: `v2-9-${user.label}-${user.id}@example.test`,
      fullName: user.fullName,
      passwordHash: "not-used-by-v2-9-tests",
      role: "STUDENT" as const,
      status: "ACTIVE" as const,
    })),
  });
  await db.userCapabilityAssignment.createMany({
    data: [
      { userId: ids.generate, capability: "GENERATE_DOCUMENTS" as const },
      { userId: ids.release, capability: "RELEASE_DOCUMENTS" as const },
      { userId: ids.revoke, capability: "REVOKE_DOCUMENTS" as const },
      ...["GENERATE_DOCUMENTS", "RELEASE_DOCUMENTS", "REVOKE_DOCUMENTS"].map(
        (capability) => ({
          userId: ids.all,
          capability: capability as
            "GENERATE_DOCUMENTS" | "RELEASE_DOCUMENTS" | "REVOKE_DOCUMENTS",
        }),
      ),
      { userId: ids.disabled, capability: "GENERATE_DOCUMENTS" as const },
    ],
  });
  await db.studentProfile.createMany({
    data: [
      { id: ids.profileA, userId: ids.studentA, suffix: "A" },
      { id: ids.profileB, userId: ids.studentB, suffix: "B" },
    ].map((profile) => ({
      id: profile.id,
      userId: profile.userId,
      studentNumber: `V2-9-${profile.suffix}-${profile.id}`.toUpperCase(),
      program: "Software Engineering",
      academicYear: "YEAR_3" as const,
    })),
  });
  await db.requestCategory.create({
    data: {
      id: ids.category,
      name: `V2-9 Request Fulfilment ${ids.category}`,
      slug: `v2-9-request-fulfilment-${ids.category}`,
      isActive: true,
    },
  });
});

afterAll(async () => {
  await verified.close();
});

describe("V2-9 PostgreSQL document lifecycle", () => {
  it("verifies the current document catalog after later migrations", async () => {
    const [migrationCounts, enums, constraints, indexes, foreignKeys] =
      await Promise.all([
        db.$queryRaw<
          Array<{ total: number; successful: number; failed: number }>
        >`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (
              WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
            )::int AS successful,
            count(*) FILTER (
              WHERE finished_at IS NULL AND rolled_back_at IS NULL
            )::int AS failed
          FROM _prisma_migrations
        `,
        db.$queryRaw<Array<{ count: number }>>`
          SELECT count(DISTINCT typname)::int AS count
          FROM pg_type
          WHERE typname IN (
            'DocumentArtifactType',
            'DocumentArtifactStatus',
            'DocumentStorageProvider'
          )
        `,
        db.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count
          FROM pg_constraint
          WHERE conrelid = '"DocumentArtifact"'::regclass
        `,
        db.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count
          FROM pg_indexes
          WHERE tablename = 'DocumentArtifact'
        `,
        db.$queryRaw<Array<{ count: number }>>`
          SELECT count(*)::int AS count
          FROM pg_constraint
          WHERE conrelid = '"DocumentArtifact"'::regclass
            AND contype = 'f'
        `,
      ]);
    expect(migrationCounts).toEqual([{ total: 11, successful: 11, failed: 0 }]);
    expect(enums).toEqual([{ count: 3 }]);
    expect(constraints[0]?.count).toBeGreaterThanOrEqual(10);
    expect(indexes[0]?.count).toBeGreaterThanOrEqual(5);
    expect(foreignKeys).toEqual([{ count: 5 }]);
  });

  it("serializes concurrent generation into unique ordered versions", async () => {
    const request = await createRequest();
    const results = await Promise.all([
      generate(request.id),
      generate(request.id),
    ]);
    expect(
      results.every((result) => result.ok),
      JSON.stringify(lastGenerationFailure),
    ).toBe(true);
    const versions = await db.documentArtifact.findMany({
      where: { requestId: request.id },
      orderBy: { version: "asc" },
      select: { version: true, status: true, storageKey: true },
    });
    expect(versions.map(({ version }) => version)).toEqual([1, 2]);
    expect(new Set(versions.map(({ storageKey }) => storageKey)).size).toBe(2);
    expect(versions.every(({ status }) => status === "GENERATED")).toBe(true);
  });

  it("releases digital documents atomically and supersedes an older release", async () => {
    const request = await createRequest();
    const first = await generate(request.id);
    const second = await generate(request.id);
    if (!first.ok || !second.ok) throw new Error("fixture generation failed");
    await expect(
      releaseDocumentAsActor(
        claims(ids.all),
        { artifactId: first.artifactId },
        db,
        storage,
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      releaseDocumentAsActor(
        claims(ids.all),
        { artifactId: second.artifactId },
        db,
        storage,
      ),
    ).resolves.toMatchObject({ ok: true });
    const [updatedRequest, artifacts, notifications] = await Promise.all([
      db.documentRequest.findUniqueOrThrow({ where: { id: request.id } }),
      db.documentArtifact.findMany({
        where: { requestId: request.id },
        orderBy: { version: "asc" },
      }),
      db.notification.findMany({
        where: { requestId: request.id, eventType: "DOCUMENT_RELEASED" },
      }),
    ]);
    expect(updatedRequest.status).toBe("COMPLETED");
    expect(artifacts.map(({ status }) => status)).toEqual([
      "SUPERSEDED",
      "RELEASED",
    ]);
    expect(artifacts[0]?.supersededByArtifactId).toBe(second.artifactId);
    expect(notifications).toHaveLength(2);
    const auditCount = await db.auditLog.count({
      where: {
        entityId: second.artifactId,
        action: "DOCUMENT_RELEASED",
      },
    });
    await releaseDocumentAsActor(
      claims(ids.all),
      { artifactId: second.artifactId },
      db,
      storage,
    );
    expect(
      await db.auditLog.count({
        where: { entityId: second.artifactId, action: "DOCUMENT_RELEASED" },
      }),
    ).toBe(auditCount);
  });

  it("keeps campus-pickup requests READY and denies student download", async () => {
    const request = await createRequest("CAMPUS_PICKUP");
    const generated = await generate(request.id);
    if (!generated.ok) throw new Error("fixture generation failed");
    await releaseDocumentAsActor(
      claims(ids.all),
      { artifactId: generated.artifactId },
      db,
      storage,
    );
    expect(
      (
        await db.documentRequest.findUniqueOrThrow({
          where: { id: request.id },
        })
      ).status,
    ).toBe("READY");
    await expect(
      downloadStudentDocument(
        claims(ids.studentA),
        { artifactId: generated.artifactId },
        db,
        storage,
      ),
    ).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("revokes immediately, keeps the reason private, and is idempotent", async () => {
    const request = await createRequest();
    const generated = await generate(request.id);
    if (!generated.ok) throw new Error("fixture generation failed");
    await releaseDocumentAsActor(
      claims(ids.all),
      { artifactId: generated.artifactId },
      db,
      storage,
    );
    const first = await revokeDocumentAsActor(
      claims(ids.all),
      {
        artifactId: generated.artifactId,
        reason: "  Superseded by correction  ",
      },
      db,
    );
    const second = await revokeDocumentAsActor(
      claims(ids.all),
      { artifactId: generated.artifactId, reason: "Repeated action" },
      db,
    );
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    const artifact = await db.documentArtifact.findUniqueOrThrow({
      where: { id: generated.artifactId },
    });
    expect(artifact.status).toBe("REVOKED");
    expect(artifact.revocationReason).toBe("Superseded by correction");
    expect(
      await db.notification.count({
        where: { requestId: request.id, eventType: "DOCUMENT_REVOKED" },
      }),
    ).toBe(1);
    await expect(
      downloadStudentDocument(
        claims(ids.studentA),
        { artifactId: generated.artifactId },
        db,
        storage,
      ),
    ).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("serializes a release/revoke race to one valid final state", async () => {
    const request = await createRequest();
    const generated = await generate(request.id);
    if (!generated.ok) throw new Error("fixture generation failed");
    const [release, revoke] = await Promise.all([
      releaseDocumentAsActor(
        claims(ids.release),
        { artifactId: generated.artifactId },
        db,
        storage,
      ),
      revokeDocumentAsActor(
        claims(ids.revoke),
        { artifactId: generated.artifactId, reason: "Race-safe revocation" },
        db,
      ),
    ]);
    const artifact = await db.documentArtifact.findUniqueOrThrow({
      where: { id: generated.artifactId },
    });
    expect(["RELEASED", "REVOKED"]).toContain(artifact.status);
    expect(
      [release, revoke].filter((result) => result.ok).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      artifact.status === "REVOKED"
        ? artifact.revokedById !== null
        : artifact.revokedById === null,
    ).toBe(true);
  });

  it("enforces exact capabilities, active sessions, role, and ownership", async () => {
    const request = await createRequest();
    const generated = await generate(request.id, ids.generate);
    if (!generated.ok) throw new Error("fixture generation failed");
    await expect(generate(request.id, ids.release)).resolves.toEqual({
      ok: false,
      reason: "MISSING_CAPABILITY",
    });
    await expect(
      releaseDocumentAsActor(
        claims(ids.generate),
        { artifactId: generated.artifactId },
        db,
        storage,
      ),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
    await expect(generate(request.id, ids.zero)).resolves.toEqual({
      ok: false,
      reason: "MISSING_CAPABILITY",
    });
    await expect(generate(request.id, ids.disabled)).resolves.toEqual({
      ok: false,
      reason: "DISABLED_ACCOUNT",
    });
    await expect(
      generateDocumentAsActor(
        claims(ids.generate, 99),
        { requestId: request.id },
        db,
        { storage, generatePdf: fakePdf as never },
      ),
    ).resolves.toEqual({ ok: false, reason: "STALE_SESSION" });
    await expect(generate(request.id, ids.studentA)).resolves.toEqual({
      ok: false,
      reason: "WRONG_ROLE",
    });
    await releaseDocumentAsActor(
      claims(ids.release),
      { artifactId: generated.artifactId },
      db,
      storage,
    );
    await expect(
      downloadStudentDocument(
        claims(ids.studentB),
        { artifactId: generated.artifactId },
        db,
        storage,
      ),
    ).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
    await expect(
      downloadStaffDocument(
        claims(ids.revoke),
        { artifactId: generated.artifactId },
        db,
        storage,
      ),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
    await expect(
      listStaffDocuments(claims(ids.zero), { page: 1 }, db),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
    await expect(
      getStudentDocumentDetails(claims(ids.studentB), generated.artifactId, db),
    ).resolves.toEqual({ ok: true, artifact: null });
  });

  it("rolls release back when required audit or notification creation fails", async () => {
    for (const model of ["auditLog", "notification"] as const) {
      const request = await createRequest();
      const generated = await generate(request.id);
      if (!generated.ok) throw new Error("fixture generation failed");
      const extended = (model === "auditLog"
        ? db.$extends({
            query: {
              auditLog: {
                create() {
                  throw new Error("forced transactional dependency failure");
                },
              },
            },
          })
        : db.$extends({
            query: {
              notification: {
                upsert() {
                  throw new Error("forced transactional dependency failure");
                },
              },
            },
          })) as unknown as PrismaClient;
      await expect(
        releaseDocumentAsActor(
          claims(ids.all),
          { artifactId: generated.artifactId },
          extended,
          storage,
        ),
      ).rejects.toThrow("forced transactional dependency failure");
      expect(
        await db.documentArtifact.findUniqueOrThrow({
          where: { id: generated.artifactId },
          select: { status: true },
        }),
      ).toEqual({ status: "GENERATED" });
      expect(
        await db.documentRequest.findUniqueOrThrow({
          where: { id: request.id },
          select: { status: true },
        }),
      ).toEqual({ status: "READY" });
    }
  });

  it("compensates uploaded bytes when required audit creation fails", async () => {
    const request = await createRequest();
    const beforeKeys = await storage.list("documents/");
    const extended = db.$extends({
      query: {
        auditLog: {
          create() {
            throw new Error("forced required audit failure");
          },
        },
      },
    }) as unknown as PrismaClient;
    const result = await generateDocumentAsActor(
      claims(ids.all),
      { requestId: request.id },
      extended,
      { storage, generatePdf: fakePdf as never },
    );
    expect(result).toEqual({ ok: false, reason: "PROVIDER_FAILURE" });
    expect(
      await db.documentArtifact.count({ where: { requestId: request.id } }),
    ).toBe(0);
    expect(await storage.list("documents/")).toHaveLength(beforeKeys.length);
  });

  it("cleans only aged unreferenced objects and is idempotent", async () => {
    const old = new Date("2026-08-01T00:00:00.000Z");
    const isolatedStorage = new InMemoryDocumentStorage(() => old);
    await isolatedStorage.put(
      "documents/orphan/v1/object.pdf",
      new Uint8Array([1]),
    );
    const request = await createRequest();
    const referenced = await generateDocumentAsActor(
      claims(ids.all),
      { requestId: request.id },
      db,
      {
        storage: isolatedStorage,
        generatePdf: fakePdf as never,
        now: () => old,
      },
    );
    if (!referenced.ok) throw new Error("fixture generation failed");
    const first = await cleanupOrphanDocuments(db, isolatedStorage, {
      now: new Date("2026-08-04T00:00:00.000Z"),
      minimumAgeMs: 60_000,
    });
    const second = await cleanupOrphanDocuments(db, isolatedStorage, {
      now: new Date("2026-08-04T00:00:00.000Z"),
      minimumAgeMs: 60_000,
    });
    expect(first).toEqual({ inspected: 2, deleted: 1 });
    expect(second).toEqual({ inspected: 1, deleted: 0 });
    expect(
      await isolatedStorage.exists(
        (
          await db.documentArtifact.findUniqueOrThrow({
            where: { id: referenced.artifactId },
          })
        ).storageKey,
      ),
    ).toBe(true);
  });
});
