// @vitest-environment node

import { randomUUID } from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type TestContext,
  vi,
} from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  getRegistryImportBatch,
  listRegistryImportBatches,
} from "@/server/registry-import/reads.node";
import {
  approveRegistryImportAsActor,
  purgeExpiredRegistryImportStaging,
  rejectRegistryImportAsActor,
  submitRegistryImportAsActor,
  uploadRegistryImportAsActor,
} from "@/server/registry-import/workflow.node";
import {
  tryOpenPackageBTestDatabase,
  type VerifiedPackageBTestDatabase,
  type VerifiedPackageBTestDatabaseClient,
} from "@/test/package-b-test-database.node";

const ids = {
  uploader: "a8200000-0000-4000-8000-000000000001",
  uploaderB: "a8200000-0000-4000-8000-000000000002",
  dual: "a8200000-0000-4000-8000-000000000003",
  reviewerA: "a8200000-0000-4000-8000-000000000004",
  reviewerB: "a8200000-0000-4000-8000-000000000005",
  zero: "a8200000-0000-4000-8000-000000000006",
  disabled: "a8200000-0000-4000-8000-000000000007",
  stale: "a8200000-0000-4000-8000-000000000008",
  student: "a8200000-0000-4000-8000-000000000009",
  registeredStudent: "a8200000-0000-4000-8000-000000000010",
} as const;

const fixtureUserIds = Object.values(ids);
const claims = (actorId: string, claimedSessionVersion = 0) => ({
  actorId,
  claimedSessionVersion,
});
const csvHeader =
  "student_number,full_name,email,program,academic_year,status\r\n";
const importActions = [
  "REGISTRY_IMPORT_UPLOADED",
  "REGISTRY_IMPORT_VALIDATED",
  "REGISTRY_IMPORT_SUBMITTED",
  "REGISTRY_IMPORT_APPROVED",
  "REGISTRY_IMPORT_REJECTED",
  "REGISTRY_IMPORT_STAGING_PURGED",
] as const;

let verified: VerifiedPackageBTestDatabase | undefined;
let database: VerifiedPackageBTestDatabaseClient | undefined;

vi.setConfig({ hookTimeout: 60_000, testTimeout: 60_000 });

function databaseOrSkip(
  context: TestContext,
): VerifiedPackageBTestDatabaseClient {
  if (database) return database;
  context.skip(
    "V2-8 PostgreSQL integration requires the verified isolated TEST_DATABASE_URL.",
  );
}

function csvFile(rows: readonly string[]) {
  const body = `${csvHeader}${rows.join("\r\n")}\r\n`;
  return {
    bytes: new TextEncoder().encode(body),
    filename: "registry.csv",
    mimeType: "text/csv",
  };
}

function validRow(
  input: {
    studentNumber?: string;
    fullName?: string;
    email?: string;
    program?: string;
    academicYear?: string;
    status?: string;
  } = {},
) {
  const token = randomUUID().slice(0, 8).toUpperCase();
  return [
    input.studentNumber ?? `V28-${token}`,
    input.fullName ?? `V2 Eight Student ${token}`,
    input.email ?? `v28-${token.toLowerCase()}@example.test`,
    input.program ?? "BAC+3 Software Engineering",
    input.academicYear ?? "YEAR_1",
    input.status ?? "ACTIVE",
  ].join(",");
}

async function cleanupFixtures(db: PrismaClient): Promise<void> {
  const batches = await db.importBatch.findMany({
    where: { uploaderId: { in: fixtureUserIds } },
    select: { id: true },
  });
  const batchIds = batches.map(({ id }) => id);
  await db.importBatch.deleteMany({ where: { id: { in: batchIds } } });
  await db.studentRegistry.deleteMany({
    where: { studentNumber: { startsWith: "V28-" } },
  });
  await db.userCapabilityAssignment.deleteMany({
    where: { userId: { in: fixtureUserIds } },
  });
}

async function createActors(db: PrismaClient): Promise<void> {
  const actorRows = [
    [ids.uploader, "uploader", "STAFF", "ACTIVE", 0],
    [ids.uploaderB, "uploader-b", "STAFF", "ACTIVE", 0],
    [ids.dual, "dual", "STAFF", "ACTIVE", 0],
    [ids.reviewerA, "reviewer-a", "STAFF", "ACTIVE", 0],
    [ids.reviewerB, "reviewer-b", "STAFF", "ACTIVE", 0],
    [ids.zero, "zero", "STAFF", "ACTIVE", 0],
    [ids.disabled, "disabled", "STAFF", "DISABLED", 0],
    [ids.stale, "stale", "STAFF", "ACTIVE", 1],
    [ids.student, "student", "STUDENT", "ACTIVE", 0],
    [ids.registeredStudent, "registered", "STUDENT", "ACTIVE", 0],
  ] as const;
  for (const [id, label, role, status, sessionVersion] of actorRows) {
    const data = {
      email: `v28-${label}@example.test`,
      fullName: `V2-8 ${label}`,
      passwordHash: "suite-owned-non-authenticating-value",
      role,
      status,
      sessionVersion,
      disabledAt:
        status === "DISABLED" ? new Date("2026-08-01T00:00:00.000Z") : null,
      disabledById: status === "DISABLED" ? ids.reviewerA : null,
    };
    await db.user.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }
  await db.userCapabilityAssignment.createMany({
    data: [
      { userId: ids.uploader, capability: "REGISTRY_IMPORT_UPLOAD" },
      { userId: ids.uploaderB, capability: "REGISTRY_IMPORT_UPLOAD" },
      { userId: ids.dual, capability: "REGISTRY_IMPORT_UPLOAD" },
      { userId: ids.dual, capability: "REGISTRY_IMPORT_APPROVE" },
      { userId: ids.reviewerA, capability: "REGISTRY_IMPORT_APPROVE" },
      { userId: ids.reviewerB, capability: "REGISTRY_IMPORT_APPROVE" },
      { userId: ids.disabled, capability: "REGISTRY_IMPORT_APPROVE" },
      { userId: ids.stale, capability: "REGISTRY_IMPORT_APPROVE" },
      { userId: ids.student, capability: "REGISTRY_IMPORT_UPLOAD" },
    ],
  });
}

async function uploadValid(
  db: PrismaClient,
  actorId: string = ids.uploader,
  rows: readonly string[] = [validRow()],
) {
  const result = await uploadRegistryImportAsActor(
    claims(actorId),
    csvFile(rows),
    db,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("V2-8 test upload failed.");
  expect(result.status).toBe("VALIDATED");
  return result;
}

async function createPendingBatch(
  db: PrismaClient,
  actorId: string = ids.uploader,
  rows: readonly string[] = [validRow()],
) {
  const upload = await uploadValid(db, actorId, rows);
  await expect(
    submitRegistryImportAsActor(claims(actorId), upload.batchId, db),
  ).resolves.toEqual({ ok: true, status: "PENDING_APPROVAL" });
  return upload;
}

beforeAll(async () => {
  const readiness = await tryOpenPackageBTestDatabase(process.env);
  if (!readiness.ready) return;
  verified = readiness.verified;
  database = readiness.verified.database;
});

beforeEach(async () => {
  if (!database) return;
  await cleanupFixtures(database);
  await createActors(database);
});

afterEach(async () => {
  if (database) await cleanupFixtures(database);
});

afterAll(async () => {
  await verified?.close();
});

describe("V2-8 registry import PostgreSQL workflow", () => {
  it("enforces lifecycle, valid-only submission, duplicate identity, and raw-file non-retention", async (context) => {
    const db = databaseOrSkip(context);
    const invalidFile = csvFile([validRow({ email: "not-an-email" })]);
    const invalid = await uploadRegistryImportAsActor(
      claims(ids.uploader),
      invalidFile,
      db,
    );
    expect(invalid).toMatchObject({
      ok: true,
      status: "UPLOADED",
      totalRows: 1,
      validRows: 0,
      invalidRows: 1,
    });
    if (!invalid.ok) return;
    await expect(
      submitRegistryImportAsActor(claims(ids.uploader), invalid.batchId, db),
    ).resolves.toEqual({ ok: false, reason: "INVALID_TRANSITION" });

    const file = csvFile([validRow()]);
    const valid = await uploadRegistryImportAsActor(
      claims(ids.uploader),
      file,
      db,
    );
    expect(valid).toMatchObject({ ok: true, status: "VALIDATED" });
    if (!valid.ok) return;
    await expect(
      uploadRegistryImportAsActor(claims(ids.uploader), file, db),
    ).resolves.toEqual({ ok: false, reason: "DUPLICATE_FILE" });
    await expect(
      submitRegistryImportAsActor(claims(ids.uploader), valid.batchId, db),
    ).resolves.toEqual({ ok: true, status: "PENDING_APPROVAL" });
    const stored = await db.importBatch.findUniqueOrThrow({
      where: { id: valid.batchId },
      include: { rows: true },
    });
    expect(stored.status).toBe("PENDING_APPROVAL");
    const forbiddenRawFields = [
      "bytes",
      "rawFile",
      "fileBytes",
      "fileContent",
      "filePath",
      "workbookBytes",
    ];
    expect(Object.keys(stored)).not.toEqual(
      expect.arrayContaining(forbiddenRawFields),
    );
    expect(Object.keys(stored.rows[0] ?? {})).not.toEqual(
      expect.arrayContaining(forbiddenRawFields),
    );
  });

  it("enforces exact role, account, session, capability, and four-eyes denials", async (context) => {
    const db = databaseOrSkip(context);
    const file = csvFile([validRow()]);
    await expect(
      uploadRegistryImportAsActor(claims(ids.reviewerA), file, db),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
    await expect(
      uploadRegistryImportAsActor(claims(ids.student), file, db),
    ).resolves.toEqual({ ok: false, reason: "WRONG_ROLE" });
    await expect(
      uploadRegistryImportAsActor(
        { actorId: undefined, claimedSessionVersion: undefined },
        file,
        db,
      ),
    ).resolves.toEqual({ ok: false, reason: "UNAUTHENTICATED" });

    const pending = await createPendingBatch(db);
    await expect(
      approveRegistryImportAsActor(claims(ids.uploader), pending.batchId, db),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
    await expect(
      approveRegistryImportAsActor(claims(ids.disabled), pending.batchId, db),
    ).resolves.toEqual({ ok: false, reason: "DISABLED_ACCOUNT" });
    await expect(
      approveRegistryImportAsActor(claims(ids.stale), pending.batchId, db),
    ).resolves.toEqual({ ok: false, reason: "STALE_SESSION" });
    await expect(
      approveRegistryImportAsActor(claims(ids.zero), pending.batchId, db),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });

    const self = await createPendingBatch(db, ids.dual);
    await expect(
      approveRegistryImportAsActor(claims(ids.dual), self.batchId, db),
    ).resolves.toEqual({ ok: false, reason: "SELF_REVIEW" });
    await expect(
      rejectRegistryImportAsActor(
        claims(ids.dual),
        { batchId: self.batchId, reason: "Independent review required" },
        db,
      ),
    ).resolves.toEqual({ ok: false, reason: "SELF_REVIEW" });
  });

  it("applies a whole batch while preserving registration linkage and updating only allowed fields", async (context) => {
    const db = databaseOrSkip(context);
    const registeredAt = new Date("2026-01-02T03:04:05.000Z");
    const existing = await db.studentRegistry.create({
      data: {
        studentNumber: "V28-EXISTING",
        fullName: "Existing Student",
        normalizedFullName: "existing student",
        email: "v28-existing@example.test",
        program: "Foundation Year",
        academicYear: "FOUNDATION",
        status: "INACTIVE",
        source: "DEVELOPMENT_DEMO",
        registeredUserId: ids.registeredStudent,
        registeredAt,
      },
    });
    const createdNumber = `V28-${randomUUID().slice(0, 8).toUpperCase()}`;
    const pending = await createPendingBatch(db, ids.uploader, [
      validRow({
        studentNumber: existing.studentNumber,
        fullName: "Updated Student",
        email: "v28-updated@example.test",
        program: "BAC+3 Computer Security",
        academicYear: "YEAR_2",
        status: "ACTIVE",
      }),
      validRow({ studentNumber: createdNumber }),
    ]);

    await expect(
      approveRegistryImportAsActor(claims(ids.reviewerA), pending.batchId, db),
    ).resolves.toEqual({ ok: true, status: "APPROVED" });
    const updated = await db.studentRegistry.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(updated).toMatchObject({
      id: existing.id,
      studentNumber: existing.studentNumber,
      fullName: "Updated Student",
      email: "v28-updated@example.test",
      program: "BAC+3 Computer Security",
      academicYear: "YEAR_2",
      status: "ACTIVE",
      source: "OFFICIAL_IMPORT",
      registeredUserId: ids.registeredStudent,
      registeredAt,
      createdAt: existing.createdAt,
    });
    expect(
      await db.studentRegistry.findUnique({
        where: { studentNumber: createdNumber },
      }),
    ).toMatchObject({ source: "OFFICIAL_IMPORT", registeredUserId: null });
    expect(
      await db.importBatch.findUnique({ where: { id: pending.batchId } }),
    ).toMatchObject({
      status: "APPROVED",
      reviewerId: ids.reviewerA,
      purgedAt: null,
    });
  });

  it("rejects a stale cross-record email collision without partial registry writes", async (context) => {
    const db = databaseOrSkip(context);
    const targetNumber = `V28-${randomUUID().slice(0, 8).toUpperCase()}`;
    const collisionEmail = `v28-collision-${randomUUID().slice(0, 8)}@example.test`;
    const pending = await createPendingBatch(db, ids.uploader, [
      validRow({ studentNumber: targetNumber, email: collisionEmail }),
    ]);
    await db.studentRegistry.create({
      data: {
        studentNumber: `V28-${randomUUID().slice(0, 8).toUpperCase()}`,
        fullName: "Collision Owner",
        normalizedFullName: "collision owner",
        email: collisionEmail,
        program: "Foundation Year",
        academicYear: "FOUNDATION",
        status: "ACTIVE",
        source: "DEVELOPMENT_DEMO",
      },
    });

    await expect(
      approveRegistryImportAsActor(claims(ids.reviewerA), pending.batchId, db),
    ).resolves.toEqual({ ok: false, reason: "REGISTRY_CONFLICT" });
    expect(
      await db.studentRegistry.findUnique({
        where: { studentNumber: targetNumber },
      }),
    ).toBeNull();
    expect(
      await db.importBatch.findUnique({ where: { id: pending.batchId } }),
    ).toMatchObject({ status: "PENDING_APPROVAL", reviewerId: null });
  });

  it("rolls back the whole batch when a registry write fails", async (context) => {
    const db = databaseOrSkip(context);
    const first = `V28-${randomUUID().slice(0, 8).toUpperCase()}`;
    const second = `V28-${randomUUID().slice(0, 8).toUpperCase()}`;
    const pending = await createPendingBatch(db, ids.uploader, [
      validRow({ studentNumber: first }),
      validRow({ studentNumber: second }),
    ]);
    let writes = 0;
    const failing = db.$extends({
      query: {
        studentRegistry: {
          async create({ args, query }) {
            writes += 1;
            if (writes === 2) throw new Error("suite-owned controlled failure");
            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;

    await expect(
      approveRegistryImportAsActor(
        claims(ids.reviewerA),
        pending.batchId,
        failing,
      ),
    ).rejects.toThrow("suite-owned controlled failure");
    expect(
      await db.studentRegistry.count({
        where: { studentNumber: { in: [first, second] } },
      }),
    ).toBe(0);
    expect(
      await db.importBatch.findUnique({ where: { id: pending.batchId } }),
    ).toMatchObject({ status: "PENDING_APPROVAL", reviewerId: null });
  });

  it("rolls back registry changes when the required approval audit write fails", async (context) => {
    const db = databaseOrSkip(context);
    const studentNumber = `V28-${randomUUID().slice(0, 8).toUpperCase()}`;
    const pending = await createPendingBatch(db, ids.uploader, [
      validRow({ studentNumber }),
    ]);
    const failing = db.$extends({
      query: {
        auditLog: {
          async create({ args, query }) {
            const data = args.data as { action?: string };
            if (data.action === "REGISTRY_IMPORT_APPROVED") {
              throw new Error("suite-owned audit failure");
            }
            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;

    await expect(
      approveRegistryImportAsActor(
        claims(ids.reviewerA),
        pending.batchId,
        failing,
      ),
    ).rejects.toThrow("suite-owned audit failure");
    expect(
      await db.studentRegistry.findUnique({ where: { studentNumber } }),
    ).toBeNull();
    expect(
      await db.importBatch.findUnique({ where: { id: pending.batchId } }),
    ).toMatchObject({ status: "PENDING_APPROVAL", reviewerId: null });
    expect(
      await db.auditLog.count({
        where: {
          entityId: pending.batchId,
          action: "REGISTRY_IMPORT_APPROVED",
        },
      }),
    ).toBe(0);
  });

  it("allows exactly one concurrent approval", async (context) => {
    const db = databaseOrSkip(context);
    const studentNumber = `V28-${randomUUID().slice(0, 8).toUpperCase()}`;
    const pending = await createPendingBatch(db, ids.uploader, [
      validRow({ studentNumber }),
    ]);
    const independent = await verified!.openIndependentConnection();
    try {
      const results = await Promise.all([
        approveRegistryImportAsActor(
          claims(ids.reviewerA),
          pending.batchId,
          db,
        ),
        approveRegistryImportAsActor(
          claims(ids.reviewerB),
          pending.batchId,
          independent,
        ),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([
        { ok: false, reason: "INVALID_TRANSITION" },
      ]);
      expect(await db.studentRegistry.count({ where: { studentNumber } })).toBe(
        1,
      );
      expect(
        await db.auditLog.count({
          where: {
            entityId: pending.batchId,
            action: "REGISTRY_IMPORT_APPROVED",
          },
        }),
      ).toBe(1);
    } finally {
      await verified!.closeIndependentConnection(independent);
    }
  });

  it("serializes approval and rejection so only one terminal transition succeeds", async (context) => {
    const db = databaseOrSkip(context);
    const studentNumber = `V28-${randomUUID().slice(0, 8).toUpperCase()}`;
    const pending = await createPendingBatch(db, ids.uploader, [
      validRow({ studentNumber }),
    ]);
    const independent = await verified!.openIndependentConnection();
    try {
      const results = await Promise.all([
        approveRegistryImportAsActor(
          claims(ids.reviewerA),
          pending.batchId,
          db,
        ),
        rejectRegistryImportAsActor(
          claims(ids.reviewerB),
          { batchId: pending.batchId, reason: "Independent rejection" },
          independent,
        ),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([
        { ok: false, reason: "INVALID_TRANSITION" },
      ]);
      const batch = await db.importBatch.findUniqueOrThrow({
        where: { id: pending.batchId },
      });
      expect(["APPROVED", "REJECTED"]).toContain(batch.status);
      expect(
        await db.auditLog.count({
          where: {
            entityId: pending.batchId,
            action: {
              in: ["REGISTRY_IMPORT_APPROVED", "REGISTRY_IMPORT_REJECTED"],
            },
          },
        }),
      ).toBe(1);
      expect(await db.studentRegistry.count({ where: { studentNumber } })).toBe(
        batch.status === "APPROVED" ? 1 : 0,
      );
    } finally {
      await verified!.closeIndependentConnection(independent);
    }
  });

  it("purges only expired non-approved staging, preserves metadata, and is idempotent", async (context) => {
    const db = databaseOrSkip(context);
    const upload = await uploadRegistryImportAsActor(
      claims(ids.uploader),
      csvFile([validRow({ email: "invalid" })]),
      db,
    );
    expect(upload.ok).toBe(true);
    if (!upload.ok) return;
    const uploadedAt = new Date("2026-06-01T00:00:00.000Z");
    const expiresAt = new Date("2026-07-01T00:00:00.000Z");
    await db.importBatch.update({
      where: { id: upload.batchId },
      data: { uploadedAt, expiresAt },
    });
    const before = await db.importBatch.findUniqueOrThrow({
      where: { id: upload.batchId },
    });

    await expect(
      purgeExpiredRegistryImportStaging(
        db,
        new Date("2026-08-03T00:00:00.000Z"),
      ),
    ).resolves.toEqual({ purged: 1 });
    const after = await db.importBatch.findUniqueOrThrow({
      where: { id: upload.batchId },
    });
    expect(after).toMatchObject({
      id: before.id,
      status: before.status,
      uploaderId: before.uploaderId,
      checksum: before.checksum,
      totalRows: before.totalRows,
      validRows: before.validRows,
      invalidRows: before.invalidRows,
    });
    expect(after.purgedAt).not.toBeNull();
    expect(
      await db.registryImportRow.count({ where: { batchId: upload.batchId } }),
    ).toBe(0);
    await expect(
      purgeExpiredRegistryImportStaging(
        db,
        new Date("2026-08-03T00:00:00.000Z"),
      ),
    ).resolves.toEqual({ purged: 0 });
  });

  it("cannot purge a batch being approved or damage its approved registry write", async (context) => {
    const db = databaseOrSkip(context);
    const studentNumber = `V28-${randomUUID().slice(0, 8).toUpperCase()}`;
    const pending = await createPendingBatch(db, ids.uploader, [
      validRow({ studentNumber }),
    ]);
    await db.importBatch.update({
      where: { id: pending.batchId },
      data: {
        uploadedAt: new Date("2026-06-01T00:00:00.000Z"),
        expiresAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    });
    const independent = await verified!.openIndependentConnection();
    try {
      const [approval, purge] = await Promise.all([
        approveRegistryImportAsActor(
          claims(ids.reviewerA),
          pending.batchId,
          db,
        ),
        purgeExpiredRegistryImportStaging(
          independent,
          new Date("2026-08-03T00:00:00.000Z"),
        ),
      ]);
      expect(approval).toEqual({ ok: true, status: "APPROVED" });
      expect(purge).toEqual({ purged: 0 });
      expect(await db.studentRegistry.count({ where: { studentNumber } })).toBe(
        1,
      );
      expect(
        await db.importBatch.findUnique({ where: { id: pending.batchId } }),
      ).toMatchObject({ status: "APPROVED", purgedAt: null });
    } finally {
      await verified!.closeIndependentConnection(independent);
    }
  });

  it("keeps batches private to owners and the independent review queue", async (context) => {
    const db = databaseOrSkip(context);
    const owned = await uploadValid(db);
    await expect(
      getRegistryImportBatch(
        claims(ids.uploaderB),
        { batchId: owned.batchId, page: 1 },
        db,
      ),
    ).resolves.toMatchObject({ ok: true, batch: null });
    await expect(
      listRegistryImportBatches(claims(ids.zero), 1, db),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });

    await submitRegistryImportAsActor(claims(ids.uploader), owned.batchId, db);
    await expect(
      getRegistryImportBatch(
        claims(ids.reviewerA),
        { batchId: owned.batchId, page: 1 },
        db,
      ),
    ).resolves.toMatchObject({
      ok: true,
      canApprove: true,
      batch: { id: owned.batchId, status: "PENDING_APPROVAL" },
    });
  });

  it("rejects forged batch counts and staged validation state", async (context) => {
    const db = databaseOrSkip(context);
    const upload = await uploadValid(db);
    await db.registryImportRow.updateMany({
      where: { batchId: upload.batchId },
      data: { validation: "INVALID", errorCodes: ["INVALID_EMAIL"] },
    });
    await expect(
      submitRegistryImportAsActor(claims(ids.uploader), upload.batchId, db),
    ).resolves.toEqual({ ok: false, reason: "INVALID_BATCH" });
    expect(
      await db.auditLog.count({
        where: {
          entityId: upload.batchId,
          action: "REGISTRY_IMPORT_SUBMITTED",
        },
      }),
    ).toBe(0);
  });

  it("makes rejection terminal", async (context) => {
    const db = databaseOrSkip(context);
    const pending = await createPendingBatch(db);
    await expect(
      rejectRegistryImportAsActor(
        claims(ids.reviewerA),
        { batchId: pending.batchId, reason: "Registry evidence mismatch" },
        db,
      ),
    ).resolves.toEqual({ ok: true, status: "REJECTED" });
    await expect(
      approveRegistryImportAsActor(claims(ids.reviewerB), pending.batchId, db),
    ).resolves.toEqual({ ok: false, reason: "INVALID_TRANSITION" });
    expect(
      await db.importBatch.findUnique({ where: { id: pending.batchId } }),
    ).toMatchObject({
      status: "REJECTED",
      reviewerId: ids.reviewerA,
      rejectionReason: "Registry evidence mismatch",
    });
  });

  it("records only the bounded import audit action set for the workflow", async (context) => {
    const db = databaseOrSkip(context);
    const pending = await createPendingBatch(db);
    await approveRegistryImportAsActor(
      claims(ids.reviewerA),
      pending.batchId,
      db,
    );
    const audit = await db.auditLog.findMany({
      where: { entityType: "ImportBatch", entityId: pending.batchId },
      orderBy: { createdAt: "asc" },
      select: { action: true, metadata: true },
    });
    expect(audit.map(({ action }) => action)).toEqual([
      "REGISTRY_IMPORT_UPLOADED",
      "REGISTRY_IMPORT_VALIDATED",
      "REGISTRY_IMPORT_SUBMITTED",
      "REGISTRY_IMPORT_APPROVED",
    ]);
    expect(
      audit.every(({ action }) => importActions.includes(action as never)),
    ).toBe(true);
    const forbiddenMetadataKeys = [
      "studentNumber",
      "fullName",
      "email",
      "password",
      "bytes",
      "rawFile",
      "fileContent",
      "connectionString",
    ];
    for (const { metadata } of audit) {
      expect(Object.keys(metadata as object)).not.toEqual(
        expect.arrayContaining(forbiddenMetadataKeys),
      );
    }
    expect(JSON.stringify(audit)).not.toMatch(/@example\.test/iu);
  });
});
