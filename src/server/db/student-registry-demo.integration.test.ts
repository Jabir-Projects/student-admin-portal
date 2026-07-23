// @vitest-environment node

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

import { StudentRegistryStatus } from "@/generated/prisma/client";
import {
  hasIsolatedTestDatabaseConfiguration,
  openVerifiedIsolatedTestDatabase,
  type VerifiedIsolatedTestDatabase,
  type VerifiedTestDatabaseClient,
} from "@/test/isolated-database.node";
import {
  reconcileStudentRegistryDemo,
  studentRegistryDemoFixtures,
} from "../../../prisma/student-registry-demo";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const hasSafeIsolatedDatabase = hasIsolatedTestDatabaseConfiguration(
  process.env,
);
let verifiedDatabase: VerifiedIsolatedTestDatabase | undefined;
let isolatedDb: VerifiedTestDatabaseClient | undefined;
const reservedFixtureIds = [
  "90000000-0000-4000-8000-000000000001",
  "90000000-0000-4000-8000-000000000002",
  "90000000-0000-4000-8000-000000000003",
] as const;
const fixtureIds = [...reservedFixtureIds];
const linkedUserId = "93000000-0000-4000-8000-000000000001";
const linkedUserEmail = "sist-test-demo-linked@example.test";

async function cleanupReservedFixtures(): Promise<void> {
  if (!isolatedDb) return;
  try {
    await isolatedDb.studentRegistry.deleteMany({
      where: { id: { in: [...reservedFixtureIds] } },
    });
    await isolatedDb.user.deleteMany({
      where: { id: linkedUserId, email: linkedUserEmail },
    });
  } catch {
    throw new Error("Student Registry demo test cleanup failed.");
  }
}

async function nonRegistryCounts() {
  return Promise.all([
    isolatedDb!.user.count(),
    isolatedDb!.studentProfile.count(),
    isolatedDb!.requestCategory.count(),
    isolatedDb!.documentRequest.count(),
    isolatedDb!.requestStatusHistory.count(),
    isolatedDb!.requestMessage.count(),
    isolatedDb!.notification.count(),
    isolatedDb!.auditLog.count(),
  ]);
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

describe.skipIf(!hasSafeIsolatedDatabase)(
  "Student Registry demo reconciliation (requires a distinct, prepared TEST_DATABASE_URL)",
  () => {
    beforeAll(async () => {
      verifiedDatabase = await openVerifiedIsolatedTestDatabase(process.env);
      isolatedDb = verifiedDatabase.database;
    });

    beforeEach(cleanupReservedFixtures);
    afterEach(cleanupReservedFixtures);
    afterAll(async () => {
      try {
        await cleanupReservedFixtures();
      } finally {
        await verifiedDatabase?.close();
      }
    });

    it("inserts exactly three rows on the first call", async () => {
      await expect(
        reconcileStudentRegistryDemo(isolatedDb!, "test"),
      ).resolves.toStrictEqual({
        inserted: 3,
        existing: 0,
        preservedLinked: 0,
        preservedInactive: 0,
      });
      await expect(
        isolatedDb!.studentRegistry.count({
          where: { id: { in: fixtureIds } },
        }),
      ).resolves.toBe(3);
    });

    it("inserts zero rows on the second call", async () => {
      await reconcileStudentRegistryDemo(isolatedDb!, "test");

      await expect(
        reconcileStudentRegistryDemo(isolatedDb!, "test"),
      ).resolves.toMatchObject({ inserted: 0, existing: 3 });
      await expect(
        isolatedDb!.studentRegistry.count({
          where: { id: { in: fixtureIds } },
        }),
      ).resolves.toBe(3);
    });

    it("preserves an exact linked fixture", async () => {
      await isolatedDb!.user.create({
        data: {
          id: linkedUserId,
          email: linkedUserEmail,
          fullName: "SIST Test Demo Linked User",
          passwordHash: "integration-test-non-authenticating-value",
          role: "STUDENT",
          status: "PENDING_APPROVAL",
        },
      });
      const userCountBeforeReconciliation = await isolatedDb!.user.count();

      await reconcileStudentRegistryDemo(isolatedDb!, "test");
      const linkedAt = new Date("2026-07-22T18:00:00.000Z");
      const linkedFixtureId = fixtureIds[0]!;
      const beforeLink = await registryIdentitySnapshot(linkedFixtureId);
      await isolatedDb!.studentRegistry.update({
        where: { id: linkedFixtureId },
        data: { registeredUserId: linkedUserId, registeredAt: linkedAt },
      });

      await expect(
        reconcileStudentRegistryDemo(isolatedDb!, "test"),
      ).resolves.toMatchObject({ preservedLinked: 1, inserted: 0 });
      const afterLink = await registryIdentitySnapshot(linkedFixtureId);
      expect(registryIdentityIsUnchanged(beforeLink, afterLink)).toBe(true);
      await expect(
        isolatedDb!.studentRegistry.findUniqueOrThrow({
          where: { id: linkedFixtureId },
          select: {
            registeredUserId: true,
            registeredAt: true,
          },
        }),
      ).resolves.toStrictEqual({
        registeredUserId: linkedUserId,
        registeredAt: linkedAt,
      });
      await expect(isolatedDb!.user.count()).resolves.toBe(
        userCountBeforeReconciliation,
      );
      await expect(
        isolatedDb!.user.count({
          where: { id: linkedUserId, email: linkedUserEmail },
        }),
      ).resolves.toBe(1);
    });

    it("preserves an exact inactive fixture", async () => {
      await reconcileStudentRegistryDemo(isolatedDb!, "test");
      const inactiveFixtureId = fixtureIds[0]!;
      await isolatedDb!.studentRegistry.update({
        where: { id: inactiveFixtureId },
        data: { status: StudentRegistryStatus.INACTIVE },
      });

      await expect(
        reconcileStudentRegistryDemo(isolatedDb!, "test"),
      ).resolves.toMatchObject({ preservedInactive: 1, inserted: 0 });
      await expect(
        isolatedDb!.studentRegistry.findUniqueOrThrow({
          where: { id: inactiveFixtureId },
          select: { status: true },
        }),
      ).resolves.toStrictEqual({ status: StudentRegistryStatus.INACTIVE });
    });

    it("rolls back all new fixtures when an identifier conflicts", async () => {
      const conflictingFixture = studentRegistryDemoFixtures[0]!;
      await isolatedDb!.studentRegistry.create({
        data: {
          ...conflictingFixture,
          studentNumber: "SIST-DEMO-CONFLICT",
          fullName: "Conflicting Demo Fixture",
          normalizedFullName: "conflicting demo fixture",
          email: "conflicting.registry@example.test",
        },
      });

      await expect(
        reconcileStudentRegistryDemo(isolatedDb!, "test"),
      ).rejects.toThrow("STUDENT_REGISTRY_DEMO_IDENTIFIER_CONFLICT");
      await expect(
        isolatedDb!.studentRegistry.count({
          where: { id: { in: fixtureIds } },
        }),
      ).resolves.toBe(1);
    });

    it("does not change non-registry model counts", async () => {
      const before = await nonRegistryCounts();

      await reconcileStudentRegistryDemo(isolatedDb!, "test");

      await expect(nonRegistryCounts()).resolves.toStrictEqual(before);
    });
  },
);
