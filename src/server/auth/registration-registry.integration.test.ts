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

import {
  Prisma,
  type PrismaClient,
  StudentRegistrySource,
  StudentRegistryStatus,
} from "@/generated/prisma/client";
import { PROGRAMS } from "@/features/auth/constants";
import { registerStudentWithDatabase } from "@/server/auth/registration.node";
import {
  hasIsolatedTestDatabaseConfiguration,
  openVerifiedIsolatedTestDatabase,
  type VerifiedIsolatedTestDatabase,
  type VerifiedTestDatabaseClient,
} from "@/test/isolated-database.node";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const genericFailure = {
  ok: false,
  message:
    "The registration could not be submitted. Check the information or contact administration.",
} as const;
const internalRegistryOptions = {
  verificationMode: "INTERNAL_REGISTRY",
  runtime: "test",
} as const;
const hasSafeIsolatedDatabase = hasIsolatedTestDatabaseConfiguration(
  process.env,
);
const transactionOptions = { maxWait: 5_000, timeout: 15_000 } as const;
const orchestrationTimeout = 10_000;
const integrationTestTimeout = 30_000;

const registryIds = {
  success: "91000000-0000-4000-8000-000000000001",
  reuse: "91000000-0000-4000-8000-000000000002",
  p2002: "91000000-0000-4000-8000-000000000003",
  race: "91000000-0000-4000-8000-000000000004",
  claimLoss: "91000000-0000-4000-8000-000000000005",
  postAuditRollback: "91000000-0000-4000-8000-000000000006",
  inactive: "91000000-0000-4000-8000-000000000010",
  emailMismatch: "91000000-0000-4000-8000-000000000011",
  fullNameMismatch: "91000000-0000-4000-8000-000000000012",
  programMismatch: "91000000-0000-4000-8000-000000000013",
  academicYearMismatch: "91000000-0000-4000-8000-000000000014",
} as const;

const userIds = {
  success: "92000000-0000-4000-8000-000000000001",
  reuse: "92000000-0000-4000-8000-000000000002",
  reuseAttempt: "92000000-0000-4000-8000-000000000021",
  p2002Existing: "92000000-0000-4000-8000-000000000003",
  p2002Attempt: "92000000-0000-4000-8000-000000000031",
  raceOne: "92000000-0000-4000-8000-000000000041",
  raceTwo: "92000000-0000-4000-8000-000000000042",
  claimLoss: "92000000-0000-4000-8000-000000000005",
  postAuditRollback: "92000000-0000-4000-8000-000000000006",
  inactive: "92000000-0000-4000-8000-000000000010",
  emailMismatch: "92000000-0000-4000-8000-000000000011",
  fullNameMismatch: "92000000-0000-4000-8000-000000000012",
  programMismatch: "92000000-0000-4000-8000-000000000013",
  academicYearMismatch: "92000000-0000-4000-8000-000000000014",
} as const;

const allRegistryIds = Object.values(registryIds);
const allUserIds = Object.values(userIds);

type InteractiveTransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

type DatabaseProxyHooks = {
  userId: string;
  afterSuccessfulPrecheck?: () => Promise<void>;
  beforeClaim?: () => Promise<void>;
  afterAuditCreate?: () => Promise<void>;
};

type AuditBaseline = {
  entityIds: readonly string[];
  ids: Set<string>;
};

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

type Settled<Result> =
  | { status: "fulfilled"; value: Result }
  | { status: "rejected"; reason: unknown };

let verifiedDatabase: VerifiedIsolatedTestDatabase | undefined;
let isolatedDb: VerifiedTestDatabaseClient | undefined;

function createDeferred(): Deferred {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function settle<Result>(promise: Promise<Result>): Promise<Settled<Result>> {
  return promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason: unknown) => ({ status: "rejected", reason }),
  );
}

async function withTimeout<Result>(
  promise: Promise<Result>,
  message: string,
): Promise<Result> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(message)),
          orchestrationTimeout,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function createTwoPartyBarrier() {
  let arrivals = 0;
  const released = createDeferred();

  return {
    arrive: async () => {
      arrivals += 1;
      if (arrivals === 2) released.resolve();
      await withTimeout(
        released.promise,
        "Registry pre-check barrier timed out.",
      );
    },
    release: released.resolve,
  };
}

function suffixNumber(suffix: string): string {
  return suffix.padStart(12, "0");
}

function registryFixture(
  suffix: string,
  overrides: Partial<Prisma.StudentRegistryCreateInput> = {},
): Prisma.StudentRegistryCreateInput {
  const number = suffixNumber(suffix);
  return {
    id: `91000000-0000-4000-8000-${number}`,
    studentNumber: `SIST-TEST-REG-${suffix}`,
    fullName: `SIST Test Registry ${suffix}`,
    normalizedFullName: `sist test registry ${suffix}`,
    email: `sist-test-reg-${suffix}@example.test`,
    program: PROGRAMS[0],
    academicYear: "FOUNDATION",
    status: StudentRegistryStatus.ACTIVE,
    source: StudentRegistrySource.OFFICIAL_IMPORT,
    ...overrides,
  };
}

function registrationPayload(
  suffix: string,
  overrides: Partial<Record<string, string>> = {},
) {
  const password = `SIST-test-${randomUUID()}!`;
  return {
    fullName: `SIST Test Registry ${suffix}`,
    email: `sist-test-reg-${suffix}@example.test`,
    password,
    confirmPassword: password,
    studentNumber: `SIST-TEST-REG-${suffix}`,
    program: PROGRAMS[0],
    academicYear: "FOUNDATION",
    ...overrides,
  };
}

function transactionWithHooks(
  transaction: Prisma.TransactionClient,
  hooks: DatabaseProxyHooks,
): Prisma.TransactionClient {
  const userDelegate = new Proxy(transaction.user, {
    get(target, property, receiver) {
      if (property !== "create") return Reflect.get(target, property, receiver);
      return (args: Prisma.UserCreateArgs) =>
        target.create({
          ...args,
          data: { ...args.data, id: hooks.userId },
        });
    },
  });

  const registryDelegate = new Proxy(transaction.studentRegistry, {
    get(target, property, receiver) {
      if (property !== "updateMany") {
        return Reflect.get(target, property, receiver);
      }
      return async (args: Prisma.StudentRegistryUpdateManyArgs) => {
        await hooks.beforeClaim?.();
        return target.updateMany(args);
      };
    },
  });

  const auditDelegate = new Proxy(transaction.auditLog, {
    get(target, property, receiver) {
      if (property !== "create") return Reflect.get(target, property, receiver);
      return async (args: Prisma.AuditLogCreateArgs) => {
        const result = await target.create(args);
        await hooks.afterAuditCreate?.();
        return result;
      };
    },
  });

  return new Proxy(transaction, {
    get(target, property, receiver) {
      if (property === "user") return userDelegate;
      if (property === "studentRegistry") return registryDelegate;
      if (property === "auditLog") return auditDelegate;
      return Reflect.get(target, property, receiver);
    },
  }) as Prisma.TransactionClient;
}

function databaseWithHooks(
  database: PrismaClient,
  hooks: DatabaseProxyHooks,
): PrismaClient {
  const registryDelegate = new Proxy(database.studentRegistry, {
    get(target, property, receiver) {
      if (property !== "findFirst") {
        return Reflect.get(target, property, receiver);
      }
      return async (args: Prisma.StudentRegistryFindFirstArgs) => {
        const result = await target.findFirst(args);
        if (result) await hooks.afterSuccessfulPrecheck?.();
        return result;
      };
    },
  });

  const transactionRunner = <Result>(
    callback: (transaction: Prisma.TransactionClient) => Promise<Result>,
    options?: InteractiveTransactionOptions,
  ) =>
    database.$transaction(
      (transaction) => callback(transactionWithHooks(transaction, hooks)),
      { ...transactionOptions, ...options },
    );

  return new Proxy(database, {
    get(target, property, receiver) {
      if (property === "studentRegistry") return registryDelegate;
      if (property === "$transaction") return transactionRunner;
      return Reflect.get(target, property, receiver);
    },
  });
}

async function cleanupScenarioRecords(): Promise<void> {
  if (!isolatedDb) return;
  try {
    await isolatedDb.studentRegistry.deleteMany({
      where: { id: { in: [...allRegistryIds] } },
    });
    await isolatedDb.user.deleteMany({
      where: { id: { in: [...allUserIds] } },
    });
  } catch {
    throw new Error("Registration Registry test cleanup failed.");
  }
}

async function captureAuditBaseline(
  entityIds: readonly string[],
): Promise<AuditBaseline> {
  const rows = await isolatedDb!.auditLog.findMany({
    where: {
      action: "STUDENT_REGISTRATION_SUBMITTED",
      entityId: { in: [...entityIds] },
    },
    select: { id: true },
  });
  return { entityIds, ids: new Set(rows.map(({ id }) => id)) };
}

async function newRegistrationAudits(baseline: AuditBaseline) {
  const rows = await isolatedDb!.auditLog.findMany({
    where: {
      action: "STUDENT_REGISTRATION_SUBMITTED",
      entityId: { in: [...baseline.entityIds] },
    },
    select: { id: true, entityId: true, metadata: true },
  });
  return rows.filter(({ id }) => !baseline.ids.has(id));
}

async function expectSafeAuditDelta(
  baseline: AuditBaseline,
  expectedDelta: number,
  forbiddenValues: readonly string[],
): Promise<Awaited<ReturnType<typeof newRegistrationAudits>>> {
  const audits = await newRegistrationAudits(baseline);
  expect(audits.length).toBe(expectedDelta);

  for (const audit of audits) {
    expect(audit.metadata).toEqual({ source: "public_registration" });
    const serialized = JSON.stringify(audit.metadata);
    const containsSensitiveMetadata = [
      ...forbiddenValues,
      "passwordHash",
      "registeredUserId",
      "studentRegistry",
      "INTERNAL_REGISTRY",
      '"runtime"',
      '"mode"',
    ].some((forbidden) => serialized.includes(forbidden));
    expect(containsSensitiveMetadata).toBe(false);
  }

  return audits;
}

async function expectNoCandidateAccount(userId: string): Promise<void> {
  await expect(isolatedDb!.user.count({ where: { id: userId } })).resolves.toBe(
    0,
  );
  await expect(
    isolatedDb!.studentProfile.count({ where: { userId } }),
  ).resolves.toBe(0);
}

async function registryIdentitySnapshot(registryId: string) {
  return isolatedDb!.studentRegistry.findUniqueOrThrow({
    where: { id: registryId },
    select: {
      studentNumber: true,
      fullName: true,
      normalizedFullName: true,
      email: true,
      program: true,
      academicYear: true,
      status: true,
      source: true,
    },
  });
}

function registryIdentityIsUnchanged(
  before: Awaited<ReturnType<typeof registryIdentitySnapshot>>,
  after: Awaited<ReturnType<typeof registryIdentitySnapshot>>,
): boolean {
  return (
    before.studentNumber === after.studentNumber &&
    before.fullName === after.fullName &&
    before.normalizedFullName === after.normalizedFullName &&
    before.email === after.email &&
    before.program === after.program &&
    before.academicYear === after.academicYear &&
    before.status === after.status &&
    before.source === after.source
  );
}

const isolatedDescribe = hasSafeIsolatedDatabase
  ? describe.sequential
  : describe.skip;

isolatedDescribe(
  "INTERNAL_REGISTRY registration against strongly verified PostgreSQL",
  () => {
    beforeAll(async () => {
      verifiedDatabase = await openVerifiedIsolatedTestDatabase(process.env);
      isolatedDb = verifiedDatabase.database;
    });

    beforeEach(cleanupScenarioRecords);
    afterEach(cleanupScenarioRecords);

    afterAll(async () => {
      try {
        await cleanupScenarioRecords();
      } finally {
        await verifiedDatabase?.close();
      }
    });

    it("registers and atomically claims suffix 0001", async () => {
      const fixture = registryFixture("0001");
      const payload = registrationPayload("0001");
      const userId = userIds.success;
      await isolatedDb!.studentRegistry.create({ data: fixture });
      const beforeIdentity = await registryIdentitySnapshot(fixture.id!);
      const auditBaseline = await captureAuditBaseline([userId]);

      const result = await registerStudentWithDatabase(
        payload,
        databaseWithHooks(isolatedDb!, { userId }),
        internalRegistryOptions,
      );

      expect(result).toEqual({ ok: true });
      const user = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          email: true,
          fullName: true,
          role: true,
          status: true,
          studentProfile: {
            select: {
              studentNumber: true,
              program: true,
              academicYear: true,
            },
          },
        },
      });
      expect(user).toMatchObject({
        email: fixture.email,
        fullName: fixture.fullName,
        role: "STUDENT",
        status: "PENDING_APPROVAL",
      });
      expect(user.studentProfile).toMatchObject({
        studentNumber: fixture.studentNumber,
        program: fixture.program,
        academicYear: fixture.academicYear,
      });
      const registry = await isolatedDb!.studentRegistry.findUniqueOrThrow({
        where: { id: fixture.id },
        select: { registeredUserId: true, registeredAt: true },
      });
      expect(registry.registeredUserId).toBe(userId);
      expect(registry.registeredAt).not.toBeNull();
      const afterIdentity = await registryIdentitySnapshot(fixture.id!);
      expect(registryIdentityIsUnchanged(beforeIdentity, afterIdentity)).toBe(
        true,
      );
      await expectSafeAuditDelta(auditBaseline, 1, [
        payload.email,
        payload.fullName,
        payload.studentNumber,
        payload.password,
        fixture.id!,
      ]);
    });

    it("rejects reuse of suffix 0002 without duplicating records", async () => {
      const fixture = registryFixture("0002");
      const payload = registrationPayload("0002");
      const auditBaseline = await captureAuditBaseline([
        userIds.reuse,
        userIds.reuseAttempt,
      ]);
      await isolatedDb!.studentRegistry.create({ data: fixture });

      const first = await registerStudentWithDatabase(
        payload,
        databaseWithHooks(isolatedDb!, { userId: userIds.reuse }),
        internalRegistryOptions,
      );
      const linkage = await isolatedDb!.studentRegistry.findUniqueOrThrow({
        where: { id: fixture.id },
        select: { registeredUserId: true, registeredAt: true },
      });
      const second = await registerStudentWithDatabase(
        payload,
        databaseWithHooks(isolatedDb!, { userId: userIds.reuseAttempt }),
        internalRegistryOptions,
      );

      expect(first).toEqual({ ok: true });
      expect(second).toEqual(genericFailure);
      await expect(
        isolatedDb!.user.count({
          where: { id: { in: [userIds.reuse, userIds.reuseAttempt] } },
        }),
      ).resolves.toBe(1);
      await expect(
        isolatedDb!.studentProfile.count({
          where: {
            userId: { in: [userIds.reuse, userIds.reuseAttempt] },
          },
        }),
      ).resolves.toBe(1);
      await expect(
        isolatedDb!.studentRegistry.findUniqueOrThrow({
          where: { id: fixture.id },
          select: { registeredUserId: true, registeredAt: true },
        }),
      ).resolves.toStrictEqual(linkage);
      const newAudits = await expectSafeAuditDelta(auditBaseline, 1, [
        payload.email,
        payload.password,
      ]);
      expect(
        newAudits.filter(({ entityId }) => entityId === userIds.reuse).length,
      ).toBe(1);
      expect(
        newAudits.filter(({ entityId }) => entityId === userIds.reuseAttempt)
          .length,
      ).toBe(0);
    });

    it("maps a real P2002 conflict generically for suffix 0003", async () => {
      const fixture = registryFixture("0003");
      const payload = registrationPayload("0003");
      const existingUser = {
        id: userIds.p2002Existing,
        email: fixture.email,
        fullName: "SIST Test P2002 Existing User",
        passwordHash: "integration-test-non-authenticating-value",
        role: "STUDENT" as const,
        status: "PENDING_APPROVAL" as const,
      };
      await isolatedDb!.studentRegistry.create({ data: fixture });
      await isolatedDb!.user.create({ data: existingUser });
      const auditBaseline = await captureAuditBaseline([userIds.p2002Attempt]);

      const result = await registerStudentWithDatabase(
        payload,
        databaseWithHooks(isolatedDb!, { userId: userIds.p2002Attempt }),
        internalRegistryOptions,
      );

      expect(result).toEqual(genericFailure);
      await expectNoCandidateAccount(userIds.p2002Attempt);
      await expect(
        isolatedDb!.user.findUniqueOrThrow({
          where: { id: userIds.p2002Existing },
          select: {
            email: true,
            fullName: true,
            role: true,
            status: true,
          },
        }),
      ).resolves.toStrictEqual({
        email: existingUser.email,
        fullName: existingUser.fullName,
        role: existingUser.role,
        status: existingUser.status,
      });
      await expect(
        isolatedDb!.studentRegistry.findUniqueOrThrow({
          where: { id: fixture.id },
          select: { registeredUserId: true, registeredAt: true },
        }),
      ).resolves.toStrictEqual({
        registeredUserId: null,
        registeredAt: null,
      });
      await expectSafeAuditDelta(auditBaseline, 0, []);
    });

    it(
      "allows exactly one concurrent claimant for suffix 0004",
      async () => {
        const fixture = registryFixture("0004");
        const payload = registrationPayload("0004");
        const barrier = createTwoPartyBarrier();
        const secondVerified = await openVerifiedIsolatedTestDatabase(
          process.env,
        );
        try {
          const auditBaseline = await captureAuditBaseline([
            userIds.raceOne,
            userIds.raceTwo,
          ]);
          await isolatedDb!.studentRegistry.create({ data: fixture });
          const calls = [
            registerStudentWithDatabase(
              payload,
              databaseWithHooks(isolatedDb!, {
                userId: userIds.raceOne,
                afterSuccessfulPrecheck: barrier.arrive,
              }),
              internalRegistryOptions,
            ),
            registerStudentWithDatabase(
              payload,
              databaseWithHooks(secondVerified.database, {
                userId: userIds.raceTwo,
                afterSuccessfulPrecheck: barrier.arrive,
              }),
              internalRegistryOptions,
            ),
          ] as const;
          try {
            const results = await Promise.all(calls);
            expect(results.filter(({ ok }) => ok).length).toBe(1);
            expect(
              results.filter(
                (result) =>
                  !result.ok && result.message === genericFailure.message,
              ).length,
            ).toBe(1);
          } finally {
            barrier.release();
            await Promise.allSettled(calls);
          }

          const users = await isolatedDb!.user.findMany({
            where: { id: { in: [userIds.raceOne, userIds.raceTwo] } },
            select: { id: true },
          });
          expect(users.length).toBe(1);
          const survivingUserId = users[0]!.id;
          await expect(
            isolatedDb!.studentProfile.count({
              where: {
                userId: { in: [userIds.raceOne, userIds.raceTwo] },
              },
            }),
          ).resolves.toBe(1);
          await expect(
            isolatedDb!.studentRegistry.findUniqueOrThrow({
              where: { id: fixture.id },
              select: { registeredUserId: true },
            }),
          ).resolves.toStrictEqual({ registeredUserId: survivingUserId });
          const losingUserId =
            survivingUserId === userIds.raceOne
              ? userIds.raceTwo
              : userIds.raceOne;
          await expectNoCandidateAccount(losingUserId);
          await expectSafeAuditDelta(auditBaseline, 1, [
            payload.email,
            payload.password,
          ]);
        } finally {
          barrier.release();
          await secondVerified.close();
        }
      },
      integrationTestTimeout,
    );

    it(
      "rolls back after deterministic claim loss for suffix 0005",
      async () => {
        const fixture = registryFixture("0005");
        const payload = registrationPayload("0005");
        const claimReached = createDeferred();
        const releaseClaim = createDeferred();
        const coordinator = await openVerifiedIsolatedTestDatabase(process.env);
        try {
          const auditBaseline = await captureAuditBaseline([userIds.claimLoss]);
          await isolatedDb!.studentRegistry.create({ data: fixture });
          const registration = settle(
            registerStudentWithDatabase(
              payload,
              databaseWithHooks(isolatedDb!, {
                userId: userIds.claimLoss,
                beforeClaim: async () => {
                  claimReached.resolve();
                  await withTimeout(
                    releaseClaim.promise,
                    "Registry claim release timed out.",
                  );
                },
              }),
              internalRegistryOptions,
            ),
          );
          let orchestrationError: unknown;
          let registrationSettlement: Awaited<typeof registration>;
          try {
            await withTimeout(
              claimReached.promise,
              "Registry claim interception timed out.",
            );
            await withTimeout(
              coordinator.database.studentRegistry.update({
                where: { id: fixture.id },
                data: { status: StudentRegistryStatus.INACTIVE },
              }),
              "Registry coordinator update timed out.",
            );
          } catch (error) {
            orchestrationError = error;
          } finally {
            releaseClaim.resolve();
            registrationSettlement = await registration;
          }
          if (orchestrationError) throw orchestrationError;
          if (registrationSettlement.status === "rejected") {
            throw registrationSettlement.reason;
          }

          expect(registrationSettlement.value).toEqual(genericFailure);
          await expectNoCandidateAccount(userIds.claimLoss);
          await expect(
            isolatedDb!.studentRegistry.findUniqueOrThrow({
              where: { id: fixture.id },
              select: {
                status: true,
                registeredUserId: true,
                registeredAt: true,
              },
            }),
          ).resolves.toStrictEqual({
            status: "INACTIVE",
            registeredUserId: null,
            registeredAt: null,
          });
          await expectSafeAuditDelta(auditBaseline, 0, []);
        } finally {
          releaseClaim.resolve();
          await coordinator.close();
        }
      },
      integrationTestTimeout,
    );

    it("rolls back every write after the audit insert for suffix 0006", async () => {
      const fixture = registryFixture("0006");
      const payload = registrationPayload("0006");
      const auditBaseline = await captureAuditBaseline([
        userIds.postAuditRollback,
      ]);
      await isolatedDb!.studentRegistry.create({ data: fixture });

      const result = await registerStudentWithDatabase(
        payload,
        databaseWithHooks(isolatedDb!, {
          userId: userIds.postAuditRollback,
          afterAuditCreate: () => {
            throw new Prisma.PrismaClientKnownRequestError(
              "test-only post-audit transaction failure",
              { code: "P2034", clientVersion: "7.8.0" },
            );
          },
        }),
        internalRegistryOptions,
      );

      expect(result).toEqual(genericFailure);
      await expectNoCandidateAccount(userIds.postAuditRollback);
      await expect(
        isolatedDb!.studentRegistry.findUniqueOrThrow({
          where: { id: fixture.id },
          select: {
            status: true,
            registeredUserId: true,
            registeredAt: true,
          },
        }),
      ).resolves.toStrictEqual({
        status: "ACTIVE",
        registeredUserId: null,
        registeredAt: null,
      });
      await expectSafeAuditDelta(auditBaseline, 0, []);
    });

    it("rejects an inactive registry row for suffix 0010", async () => {
      const fixture = registryFixture("0010", {
        status: StudentRegistryStatus.INACTIVE,
      });
      const payload = registrationPayload("0010");
      const auditBaseline = await captureAuditBaseline([userIds.inactive]);
      await isolatedDb!.studentRegistry.create({ data: fixture });

      const result = await registerStudentWithDatabase(
        payload,
        databaseWithHooks(isolatedDb!, { userId: userIds.inactive }),
        internalRegistryOptions,
      );

      expect(result).toEqual(genericFailure);
      await expectNoCandidateAccount(userIds.inactive);
      await expect(
        isolatedDb!.studentRegistry.findUniqueOrThrow({
          where: { id: fixture.id },
          select: {
            status: true,
            registeredUserId: true,
            registeredAt: true,
          },
        }),
      ).resolves.toStrictEqual({
        status: "INACTIVE",
        registeredUserId: null,
        registeredAt: null,
      });
      await expectSafeAuditDelta(auditBaseline, 0, []);
    });

    it.each([
      {
        label: "mismatch case 1",
        suffix: "0011",
        userId: userIds.emailMismatch,
        inputOverrides: {
          email: "sist-test-reg-0011-mismatch@example.test",
        },
      },
      {
        label: "mismatch case 2",
        suffix: "0012",
        userId: userIds.fullNameMismatch,
        inputOverrides: { fullName: "SIST Test Registry Name Mismatch" },
      },
      {
        label: "mismatch case 3",
        suffix: "0013",
        userId: userIds.programMismatch,
        inputOverrides: { program: PROGRAMS[1] },
      },
      {
        label: "mismatch case 4",
        suffix: "0014",
        userId: userIds.academicYearMismatch,
        inputOverrides: { academicYear: "YEAR_1" },
      },
    ])(
      "returns the generic result for $label",
      async ({ suffix, userId, inputOverrides }) => {
        const fixture = registryFixture(suffix);
        const payload = registrationPayload(suffix, inputOverrides);
        const auditBaseline = await captureAuditBaseline([userId]);
        await isolatedDb!.studentRegistry.create({ data: fixture });
        const beforeIdentity = await registryIdentitySnapshot(fixture.id!);

        const result = await registerStudentWithDatabase(
          payload,
          databaseWithHooks(isolatedDb!, { userId }),
          internalRegistryOptions,
        );

        expect(result).toEqual(genericFailure);
        await expectNoCandidateAccount(userId);
        const afterIdentity = await registryIdentitySnapshot(fixture.id!);
        expect(registryIdentityIsUnchanged(beforeIdentity, afterIdentity)).toBe(
          true,
        );
        await expect(
          isolatedDb!.studentRegistry.findUniqueOrThrow({
            where: { id: fixture.id },
            select: { registeredUserId: true, registeredAt: true },
          }),
        ).resolves.toStrictEqual({
          registeredUserId: null,
          registeredAt: null,
        });
        await expectSafeAuditDelta(auditBaseline, 0, []);
      },
    );
  },
);
