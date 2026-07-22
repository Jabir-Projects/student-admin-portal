// @vitest-environment node

import path from "node:path";

import dotenv from "dotenv";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { StudentRegistryStatus } from "@/generated/prisma/client";
import { createPrismaClient } from "@/server/db/factory.node";
import {
  reconcileStudentRegistryDemo,
  studentRegistryDemoFixtures,
} from "../../../prisma/student-registry-demo";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const developmentDatabaseUrl = process.env.DATABASE_URL;
const hasSafeIsolatedDatabase = Boolean(
  process.env.NODE_ENV === "test" &&
  testDatabaseUrl &&
  developmentDatabaseUrl &&
  testDatabaseUrl !== developmentDatabaseUrl,
);
const isolatedDb = hasSafeIsolatedDatabase
  ? createPrismaClient(testDatabaseUrl!)
  : undefined;
const reservedFixtureIds = [
  "90000000-0000-4000-8000-000000000001",
  "90000000-0000-4000-8000-000000000002",
  "90000000-0000-4000-8000-000000000003",
] as const;
const fixtureIds = [...reservedFixtureIds];

async function cleanupReservedFixtures(): Promise<void> {
  if (!isolatedDb) return;
  await isolatedDb.studentRegistry.deleteMany({
    where: { id: { in: [...reservedFixtureIds] } },
  });
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

beforeEach(cleanupReservedFixtures);
afterEach(cleanupReservedFixtures);
afterAll(async () => {
  await isolatedDb?.$disconnect();
});

describe.skipIf(!isolatedDb)(
  "Student Registry demo reconciliation (requires a distinct, prepared TEST_DATABASE_URL)",
  () => {
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

    it("preserves an exact linked fixture", async ({ skip }) => {
      const existingUser = await isolatedDb!.user.findFirst({
        select: { id: true },
      });
      if (!existingUser) {
        return skip(
          "An existing isolated-test User is required for the foreign-key linkage test.",
        );
      }

      await reconcileStudentRegistryDemo(isolatedDb!, "test");
      const linkedAt = new Date("2026-07-22T18:00:00.000Z");
      const linkedFixtureId = fixtureIds[0]!;
      await isolatedDb!.studentRegistry.update({
        where: { id: linkedFixtureId },
        data: { registeredUserId: existingUser.id, registeredAt: linkedAt },
      });

      await expect(
        reconcileStudentRegistryDemo(isolatedDb!, "test"),
      ).resolves.toMatchObject({ preservedLinked: 1, inserted: 0 });
      await expect(
        isolatedDb!.studentRegistry.findUniqueOrThrow({
          where: { id: linkedFixtureId },
          select: { registeredUserId: true, registeredAt: true },
        }),
      ).resolves.toStrictEqual({
        registeredUserId: existingUser.id,
        registeredAt: linkedAt,
      });
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
