// @vitest-environment node

import { randomUUID } from "node:crypto";
import path from "node:path";

import dotenv from "dotenv";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PROGRAMS } from "@/features/auth/constants";
import {
  approvePendingStudentAsActor,
  disableStudentAsActor,
} from "@/server/auth/account-management.node";
import {
  findOwnedStudentProfile,
  getActiveUserById,
} from "@/server/auth/dal.node";
import { registerStudentWithDatabase } from "@/server/auth/registration.node";
import {
  hasIsolatedTestDatabaseConfiguration,
  openVerifiedIsolatedTestDatabase,
  type VerifiedIsolatedTestDatabase,
  type VerifiedTestDatabaseClient,
} from "@/test/isolated-database.node";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const hasSafeIsolatedDatabase = hasIsolatedTestDatabaseConfiguration(
  process.env,
);
const administratorId = "95000000-0000-4000-8000-000000000001";
const administratorEmail = "sist-test-phase3-admin@example.test";
const scenarioUserIds = [
  "95100000-0000-4000-8000-000000000001",
  "95100000-0000-4000-8000-000000000002",
  "95100000-0000-4000-8000-000000000003",
  "95100000-0000-4000-8000-000000000004",
  "95100000-0000-4000-8000-000000000005",
  "95100000-0000-4000-8000-000000000006",
  "95100000-0000-4000-8000-000000000007",
  "95100000-0000-4000-8000-000000000008",
  "95100000-0000-4000-8000-000000000009",
] as const;
const manualRegistrationOptions = {
  verificationMode: "MANUAL_APPROVAL",
  runtime: "test",
} as const;
const transactionOptions = { maxWait: 5_000, timeout: 15_000 } as const;

type InteractiveTransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

type AuditBaseline = {
  action: string;
  entityId: string;
  ids: Set<string>;
};

let verifiedDatabase: VerifiedIsolatedTestDatabase | undefined;
let isolatedDb: VerifiedTestDatabaseClient | undefined;

function registration(
  suffix: string,
  overrides: Partial<Record<string, string>> = {},
) {
  const password = `SIST-test-${randomUUID()}!`;
  return {
    fullName: `SIST Test Phase 3 ${suffix}`,
    email: `sist-test-phase3-${suffix}@example.test`,
    password,
    confirmPassword: password,
    studentNumber: `SIST-TEST-PHASE3-${suffix}`,
    program: PROGRAMS[0],
    academicYear: "FOUNDATION",
    ...overrides,
  };
}

function transactionWithDeterministicUserId(
  transaction: Prisma.TransactionClient,
  userId: string,
): Prisma.TransactionClient {
  const userDelegate = new Proxy(transaction.user, {
    get(target, property, receiver) {
      if (property !== "create") return Reflect.get(target, property, receiver);

      return (args: Prisma.UserCreateArgs) =>
        target.create({
          ...args,
          data: { ...args.data, id: userId },
        });
    },
  });

  return new Proxy(transaction, {
    get(target, property, receiver) {
      if (property === "user") return userDelegate;
      return Reflect.get(target, property, receiver);
    },
  }) as Prisma.TransactionClient;
}

function databaseWithDeterministicUserId(
  database: PrismaClient,
  userId: string,
): PrismaClient {
  const transactionRunner = <Result>(
    callback: (transaction: Prisma.TransactionClient) => Promise<Result>,
    options?: InteractiveTransactionOptions,
  ) =>
    database.$transaction(
      (transaction) =>
        callback(transactionWithDeterministicUserId(transaction, userId)),
      { ...transactionOptions, ...options },
    );

  return new Proxy(database, {
    get(target, property, receiver) {
      if (property === "$transaction") return transactionRunner;
      return Reflect.get(target, property, receiver);
    },
  });
}

async function cleanupScenarioUsers(): Promise<void> {
  if (!isolatedDb) return;
  try {
    await isolatedDb.user.deleteMany({
      where: { id: { in: [...scenarioUserIds] } },
    });
  } catch {
    throw new Error("Phase 3 isolated test cleanup failed.");
  }
}

async function ensureAdministrator(): Promise<void> {
  const existing = await isolatedDb!.user.findUnique({
    where: { id: administratorId },
    select: {
      email: true,
      fullName: true,
      role: true,
      status: true,
    },
  });

  if (existing) {
    expect(existing).toStrictEqual({
      email: administratorEmail,
      fullName: "SIST Test Phase 3 Administrator",
      role: "ADMIN",
      status: "ACTIVE",
    });
    return;
  }

  await isolatedDb!.user.create({
    data: {
      id: administratorId,
      email: administratorEmail,
      fullName: "SIST Test Phase 3 Administrator",
      passwordHash: "integration-test-non-authenticating-value",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
}

async function captureAuditBaseline(
  action: string,
  entityId: string,
): Promise<AuditBaseline> {
  const rows = await isolatedDb!.auditLog.findMany({
    where: { action, entityId },
    select: { id: true },
  });
  return { action, entityId, ids: new Set(rows.map(({ id }) => id)) };
}

async function newAuditsSince(baseline: AuditBaseline) {
  const rows = await isolatedDb!.auditLog.findMany({
    where: { action: baseline.action, entityId: baseline.entityId },
    select: { id: true, metadata: true },
  });
  return rows.filter(({ id }) => !baseline.ids.has(id));
}

describe.skipIf(!hasSafeIsolatedDatabase)(
  "Phase 3 isolated mutations (requires a strongly verified TEST_DATABASE_URL)",
  () => {
    beforeAll(async () => {
      verifiedDatabase = await openVerifiedIsolatedTestDatabase(process.env);
      isolatedDb = verifiedDatabase.database;
      try {
        await ensureAdministrator();
      } catch (error) {
        await verifiedDatabase.close();
        verifiedDatabase = undefined;
        isolatedDb = undefined;
        throw error;
      }
    });

    beforeEach(cleanupScenarioUsers);
    afterEach(cleanupScenarioUsers);

    afterAll(async () => {
      try {
        await cleanupScenarioUsers();
      } finally {
        await verifiedDatabase?.close();
      }
    });

    it("creates registration defaults and a non-sensitive audit atomically", async () => {
      const userId = scenarioUserIds[0];
      const input = registration("0001", {
        email: "  SIST-TEST-PHASE3-0001@EXAMPLE.TEST  ",
        studentNumber: " sist-test-phase3-0001 ",
      });
      const auditBaseline = await captureAuditBaseline(
        "STUDENT_REGISTRATION_SUBMITTED",
        userId,
      );

      await expect(
        registerStudentWithDatabase(
          input,
          databaseWithDeterministicUserId(isolatedDb!, userId),
          manualRegistrationOptions,
        ),
      ).resolves.toEqual({ ok: true });

      const user = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          email: true,
          role: true,
          status: true,
          preferredLanguage: true,
          studentProfile: { select: { studentNumber: true } },
        },
      });
      expect(user).toMatchObject({
        email: input.email.trim().toLowerCase(),
        role: "STUDENT",
        status: "PENDING_APPROVAL",
        preferredLanguage: "ENGLISH",
      });
      expect(user.studentProfile?.studentNumber).toBe(
        input.studentNumber.trim().toUpperCase(),
      );

      const audits = await newAuditsSince(auditBaseline);
      expect(audits.length).toBe(1);
      expect(audits[0]?.metadata).toEqual({ source: "public_registration" });
      const serializedMetadata = JSON.stringify(audits[0]?.metadata);
      const containsSensitiveMetadata = [
        input.email.trim(),
        input.studentNumber.trim(),
        input.password,
        "passwordHash",
      ].some((forbidden) => serializedMetadata.includes(forbidden));
      expect(containsSensitiveMetadata).toBe(false);
    });

    it("maps normalized duplicates safely and rolls back a failed profile create", async () => {
      const originalId = scenarioUserIds[1];
      const duplicateId = scenarioUserIds[2];
      const rollbackId = scenarioUserIds[3];
      const original = registration("0002");
      const auditBaseline = await captureAuditBaseline(
        "STUDENT_REGISTRATION_SUBMITTED",
        originalId,
      );

      await expect(
        registerStudentWithDatabase(
          original,
          databaseWithDeterministicUserId(isolatedDb!, originalId),
          manualRegistrationOptions,
        ),
      ).resolves.toEqual({ ok: true });

      expect(
        (
          await registerStudentWithDatabase(
            {
              ...registration("0003"),
              email: ` ${original.email.toUpperCase()} `,
            },
            databaseWithDeterministicUserId(isolatedDb!, duplicateId),
            manualRegistrationOptions,
          )
        ).ok,
      ).toBe(false);

      const rollbackEmail = "sist-test-phase3-0004@example.test";
      expect(
        (
          await registerStudentWithDatabase(
            {
              ...registration("0004"),
              email: rollbackEmail,
              studentNumber: original.studentNumber.toLowerCase(),
            },
            databaseWithDeterministicUserId(isolatedDb!, rollbackId),
            manualRegistrationOptions,
          )
        ).ok,
      ).toBe(false);

      await expect(
        isolatedDb!.user.count({
          where: { id: { in: [duplicateId, rollbackId] } },
        }),
      ).resolves.toBe(0);
      expect((await newAuditsSince(auditBaseline)).length).toBe(1);
    });

    it("approves once and records the transition atomically", async () => {
      const targetId = scenarioUserIds[4];
      const input = registration("0005");
      const registrationBaseline = await captureAuditBaseline(
        "STUDENT_REGISTRATION_SUBMITTED",
        targetId,
      );
      const approvalBaseline = await captureAuditBaseline(
        "ACCOUNT_APPROVED",
        targetId,
      );

      await registerStudentWithDatabase(
        input,
        databaseWithDeterministicUserId(isolatedDb!, targetId),
        manualRegistrationOptions,
      );
      await expect(
        approvePendingStudentAsActor(administratorId, targetId, isolatedDb!),
      ).resolves.toEqual({ ok: true });
      expect(
        (
          await approvePendingStudentAsActor(
            administratorId,
            targetId,
            isolatedDb!,
          )
        ).ok,
      ).toBe(false);

      const approved = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: targetId },
        select: {
          status: true,
          approvedById: true,
          approvedAt: true,
        },
      });
      expect(approved).toMatchObject({
        status: "ACTIVE",
        approvedById: administratorId,
      });
      expect(approved.approvedAt).not.toBeNull();
      expect((await newAuditsSince(registrationBaseline)).length).toBe(1);
      expect((await newAuditsSince(approvalBaseline)).length).toBe(1);
    });

    it("supports pending and approved disable transitions and rejects stale JWT identity", async () => {
      const pendingId = scenarioUserIds[5];
      const activeId = scenarioUserIds[6];
      const pendingInput = registration("0006");
      const activeInput = registration("0007");
      const pendingRegistrationBaseline = await captureAuditBaseline(
        "STUDENT_REGISTRATION_SUBMITTED",
        pendingId,
      );
      const pendingDisableBaseline = await captureAuditBaseline(
        "ACCOUNT_DISABLED",
        pendingId,
      );
      const activeRegistrationBaseline = await captureAuditBaseline(
        "STUDENT_REGISTRATION_SUBMITTED",
        activeId,
      );
      const activeApprovalBaseline = await captureAuditBaseline(
        "ACCOUNT_APPROVED",
        activeId,
      );
      const activeDisableBaseline = await captureAuditBaseline(
        "ACCOUNT_DISABLED",
        activeId,
      );

      await registerStudentWithDatabase(
        pendingInput,
        databaseWithDeterministicUserId(isolatedDb!, pendingId),
        manualRegistrationOptions,
      );
      expect(
        (await disableStudentAsActor(administratorId, pendingId, isolatedDb!))
          .ok,
      ).toBe(true);

      await registerStudentWithDatabase(
        activeInput,
        databaseWithDeterministicUserId(isolatedDb!, activeId),
        manualRegistrationOptions,
      );
      await approvePendingStudentAsActor(
        administratorId,
        activeId,
        isolatedDb!,
      );
      const approval = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: activeId },
        select: { approvedAt: true, approvedById: true },
      });
      await disableStudentAsActor(administratorId, activeId, isolatedDb!);
      const disabled = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: activeId },
        select: {
          status: true,
          approvedAt: true,
          approvedById: true,
          disabledById: true,
        },
      });
      expect(disabled).toMatchObject({
        status: "DISABLED",
        approvedAt: approval.approvedAt,
        approvedById: approval.approvedById,
        disabledById: administratorId,
      });
      await expect(
        getActiveUserById(activeId, isolatedDb!),
      ).resolves.toBeNull();

      for (const baseline of [
        pendingRegistrationBaseline,
        pendingDisableBaseline,
        activeRegistrationBaseline,
        activeApprovalBaseline,
        activeDisableBaseline,
      ]) {
        expect((await newAuditsSince(baseline)).length).toBe(1);
      }
    });

    it("enforces ownership in the database predicate", async () => {
      const ownerId = scenarioUserIds[7];
      const otherId = scenarioUserIds[8];
      const ownerInput = registration("0008");
      const otherInput = registration("0009");
      const ownerAuditBaseline = await captureAuditBaseline(
        "STUDENT_REGISTRATION_SUBMITTED",
        ownerId,
      );
      const otherAuditBaseline = await captureAuditBaseline(
        "STUDENT_REGISTRATION_SUBMITTED",
        otherId,
      );

      await registerStudentWithDatabase(
        ownerInput,
        databaseWithDeterministicUserId(isolatedDb!, ownerId),
        manualRegistrationOptions,
      );
      await registerStudentWithDatabase(
        otherInput,
        databaseWithDeterministicUserId(isolatedDb!, otherId),
        manualRegistrationOptions,
      );
      const owner = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: ownerId },
        select: {
          id: true,
          studentProfile: { select: { id: true } },
        },
      });
      const other = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: otherId },
        select: {
          id: true,
          studentProfile: { select: { id: true } },
        },
      });
      await expect(
        findOwnedStudentProfile(
          owner.id,
          owner.studentProfile!.id,
          isolatedDb!,
        ),
      ).resolves.toEqual({ id: owner.studentProfile!.id });
      await expect(
        findOwnedStudentProfile(
          owner.id,
          other.studentProfile!.id,
          isolatedDb!,
        ),
      ).resolves.toBeNull();
      expect((await newAuditsSince(ownerAuditBaseline)).length).toBe(1);
      expect((await newAuditsSince(otherAuditBaseline)).length).toBe(1);
    });
  },
);
