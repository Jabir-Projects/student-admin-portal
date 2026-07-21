// @vitest-environment node

import { randomUUID } from "node:crypto";
import path from "node:path";

import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
import { createPrismaClient } from "@/server/db/factory.node";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const developmentDatabaseUrl = process.env.DATABASE_URL;
const hasDistinctIsolatedDatabase = Boolean(
  testDatabaseUrl && testDatabaseUrl !== developmentDatabaseUrl,
);
const isolatedDb = hasDistinctIsolatedDatabase
  ? createPrismaClient(testDatabaseUrl!)
  : undefined;
const administratorId = randomUUID();

function registration(overrides: Partial<Record<string, string>> = {}) {
  const unique = randomUUID();
  return {
    fullName: "Integration Test Student",
    email: `${unique}@example.invalid`,
    password: "integration test password",
    confirmPassword: "integration test password",
    studentNumber: `TEST-${unique}`,
    program: PROGRAMS[0],
    academicYear: "FOUNDATION",
    ...overrides,
  };
}

describe.skipIf(!isolatedDb)(
  "Phase 3 isolated mutations (requires a distinct, prepared TEST_DATABASE_URL)",
  () => {
    beforeAll(async () => {
      await isolatedDb!.user.create({
        data: {
          id: administratorId,
          email: `${administratorId}@example.invalid`,
          fullName: "Integration Test Administrator",
          passwordHash: "integration-test-non-authenticating-value",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
    });

    afterAll(async () => {
      await isolatedDb?.$disconnect();
    });

    it("creates registration defaults and a non-sensitive audit atomically", async () => {
      const input = registration({
        email: `  ${randomUUID()}@EXAMPLE.INVALID  `,
        studentNumber: ` test-${randomUUID()} `,
      });
      await expect(
        registerStudentWithDatabase(input, isolatedDb!),
      ).resolves.toEqual({
        ok: true,
      });
      const user = await isolatedDb!.user.findUniqueOrThrow({
        where: { email: input.email.trim().toLowerCase() },
        include: { studentProfile: true },
      });
      expect(user).toMatchObject({
        role: "STUDENT",
        status: "PENDING_APPROVAL",
        preferredLanguage: "ENGLISH",
      });
      expect(user.studentProfile?.studentNumber).toBe(
        input.studentNumber.trim().toUpperCase(),
      );
      const audit = await isolatedDb!.auditLog.findFirstOrThrow({
        where: {
          action: "STUDENT_REGISTRATION_SUBMITTED",
          entityId: user.id,
        },
      });
      expect(audit.metadata).toEqual({ source: "public_registration" });
      const serializedMetadata = JSON.stringify(audit.metadata);
      for (const forbidden of [
        input.email.trim(),
        input.studentNumber.trim(),
        input.password,
        "passwordHash",
      ]) {
        expect(serializedMetadata).not.toContain(forbidden);
      }
    });

    it("maps normalized duplicates safely and rolls back a failed profile create", async () => {
      const original = registration();
      expect(
        (await registerStudentWithDatabase(original, isolatedDb!)).ok,
      ).toBe(true);
      expect(
        (
          await registerStudentWithDatabase(
            {
              ...registration(),
              email: ` ${original.email.toUpperCase()} `,
            },
            isolatedDb!,
          )
        ).ok,
      ).toBe(false);

      const rollbackEmail = `${randomUUID()}@example.invalid`;
      expect(
        (
          await registerStudentWithDatabase(
            {
              ...registration(),
              email: rollbackEmail,
              studentNumber: original.studentNumber.toLowerCase(),
            },
            isolatedDb!,
          )
        ).ok,
      ).toBe(false);
      await expect(
        isolatedDb!.user.findUnique({ where: { email: rollbackEmail } }),
      ).resolves.toBeNull();
    });

    it("approves once and records the transition atomically", async () => {
      const input = registration();
      await registerStudentWithDatabase(input, isolatedDb!);
      const target = await isolatedDb!.user.findUniqueOrThrow({
        where: { email: input.email },
      });
      await expect(
        approvePendingStudentAsActor(administratorId, target.id, isolatedDb!),
      ).resolves.toEqual({ ok: true });
      expect(
        (
          await approvePendingStudentAsActor(
            administratorId,
            target.id,
            isolatedDb!,
          )
        ).ok,
      ).toBe(false);
      const approved = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: target.id },
      });
      expect(approved).toMatchObject({
        status: "ACTIVE",
        approvedById: administratorId,
      });
      expect(approved.approvedAt).not.toBeNull();
      await expect(
        isolatedDb!.auditLog.count({
          where: { action: "ACCOUNT_APPROVED", entityId: target.id },
        }),
      ).resolves.toBe(1);
    });

    it("supports pending and approved disable transitions and rejects stale JWT identity", async () => {
      const pendingInput = registration();
      await registerStudentWithDatabase(pendingInput, isolatedDb!);
      const pending = await isolatedDb!.user.findUniqueOrThrow({
        where: { email: pendingInput.email },
      });
      expect(
        (await disableStudentAsActor(administratorId, pending.id, isolatedDb!))
          .ok,
      ).toBe(true);

      const activeInput = registration();
      await registerStudentWithDatabase(activeInput, isolatedDb!);
      const active = await isolatedDb!.user.findUniqueOrThrow({
        where: { email: activeInput.email },
      });
      await approvePendingStudentAsActor(
        administratorId,
        active.id,
        isolatedDb!,
      );
      const approval = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: active.id },
        select: { approvedAt: true, approvedById: true },
      });
      await disableStudentAsActor(administratorId, active.id, isolatedDb!);
      const disabled = await isolatedDb!.user.findUniqueOrThrow({
        where: { id: active.id },
      });
      expect(disabled).toMatchObject({
        status: "DISABLED",
        approvedAt: approval.approvedAt,
        approvedById: approval.approvedById,
        disabledById: administratorId,
      });
      await expect(
        getActiveUserById(active.id, isolatedDb!),
      ).resolves.toBeNull();
      await expect(
        isolatedDb!.auditLog.count({
          where: { action: "ACCOUNT_DISABLED", entityId: active.id },
        }),
      ).resolves.toBe(1);
    });

    it("enforces ownership in the database predicate", async () => {
      const ownerInput = registration();
      const otherInput = registration();
      await registerStudentWithDatabase(ownerInput, isolatedDb!);
      await registerStudentWithDatabase(otherInput, isolatedDb!);
      const owner = await isolatedDb!.user.findUniqueOrThrow({
        where: { email: ownerInput.email },
        include: { studentProfile: true },
      });
      const other = await isolatedDb!.user.findUniqueOrThrow({
        where: { email: otherInput.email },
        include: { studentProfile: true },
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
    });
  },
);
