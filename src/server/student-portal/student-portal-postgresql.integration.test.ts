// @vitest-environment node

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  type TestContext,
} from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  cancelRequestAsActor,
  submitRequestAsActor,
} from "@/server/student-portal/mutations.node";
import {
  getOwnedRequestDetails,
  getStudentDashboard,
  listAvailableRequestCategories,
  listOwnedRequests,
} from "@/server/student-portal/reads.node";
import {
  hasPackageBTestDatabaseConfiguration,
  tryOpenPackageBTestDatabase,
  type VerifiedPackageBTestDatabase,
  type VerifiedPackageBTestDatabaseClient,
} from "@/test/package-b-test-database.node";

const studentAId = "98500000-0000-4000-8000-000000000001";
const studentBId = "98500000-0000-4000-8000-000000000002";
const profileAId = "98600000-0000-4000-8000-000000000001";
const profileBId = "98600000-0000-4000-8000-000000000002";
const categoryIds = {
  standard: "98700000-0000-4000-8000-000000000001",
  concurrent: "98700000-0000-4000-8000-000000000002",
  repeat: "98700000-0000-4000-8000-000000000003",
  rollback: "98700000-0000-4000-8000-000000000004",
} as const;
const claimsA = { actorId: studentAId, claimedSessionVersion: 0 } as const;
const claimsB = { actorId: studentBId, claimedSessionVersion: 0 } as const;
let verified: VerifiedPackageBTestDatabase | undefined;
let database: VerifiedPackageBTestDatabaseClient | undefined;

function dbOrSkip(context: TestContext) {
  if (database) return database;
  context.skip(
    "PostgreSQL integration not run: isolated TEST_DATABASE_URL was not approved and verified.",
  );
}

async function prepareFixtures(db: VerifiedPackageBTestDatabaseClient) {
  for (const [id, email, fullName] of [
    [studentAId, "v2-5-student-a@example.test", "V2-5 Student Alpha"],
    [studentBId, "v2-5-student-b@example.test", "V2-5 Student Beta"],
  ] as const) {
    await db.user.upsert({
      where: { id },
      create: {
        id,
        email,
        fullName,
        passwordHash: "suite-owned-non-authenticating-value",
        role: "STUDENT",
        status: "ACTIVE",
        sessionVersion: 0,
      },
      update: {
        email,
        fullName,
        role: "STUDENT",
        status: "ACTIVE",
        sessionVersion: 0,
        disabledAt: null,
        disabledById: null,
      },
    });
  }
  for (const [id, userId, studentNumber] of [
    [profileAId, studentAId, "V25TESTA"],
    [profileBId, studentBId, "V25TESTB"],
  ] as const) {
    await db.studentProfile.upsert({
      where: { id },
      create: {
        id,
        userId,
        studentNumber,
        program: "V2-5 Test Programme",
        academicYear: "YEAR_1",
      },
      update: {
        userId,
        studentNumber,
        program: "V2-5 Test Programme",
        academicYear: "YEAR_1",
      },
    });
  }
  for (const [name, id] of Object.entries(categoryIds)) {
    await db.requestCategory.upsert({
      where: { id },
      create: {
        id,
        name: `V2-5 ${name} request`,
        slug: `v2-5-${name}-request`,
        description: "Suite-owned request category",
        isActive: true,
      },
      update: { isActive: true },
    });
  }
  await db.documentRequest.updateMany({
    where: {
      studentId: { in: [profileAId, profileBId] },
      status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "READY"] },
    },
    data: { status: "CANCELLED" },
  });
}

beforeAll(async () => {
  if (!hasPackageBTestDatabaseConfiguration(process.env)) return;
  const readiness = await tryOpenPackageBTestDatabase(process.env);
  if (!readiness.ready) return;
  verified = readiness.verified;
  database = readiness.verified.database;
  await prepareFixtures(database);
});

afterAll(async () => {
  await verified?.close();
});

describe.sequential("V2-5 PostgreSQL workflows", () => {
  it("persists exact delivery selection and owner-constrained timeline data", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const submitted = await submitRequestAsActor(
      claimsA,
      {
        categoryId: categoryIds.standard,
        copyCount: 5,
        details: "  Student-safe detail  ",
        deliveryMethod: "DIGITAL_DELIVERY",
      },
      db,
    );
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const stored = await db.documentRequest.findUnique({
      where: { id: submitted.requestId },
      include: { statusHistory: true },
    });
    expect(stored).toMatchObject({
      studentId: profileAId,
      copyCount: 5,
      details: "Student-safe detail",
      deliveryMethod: "DIGITAL_DELIVERY",
      status: "SUBMITTED",
    });
    expect(stored?.statusHistory).toHaveLength(1);
    await db.requestMessage.createMany({
      data: [
        {
          requestId: submitted.requestId,
          visibility: "INTERNAL",
          body: "Private STAFF note",
        },
        {
          requestId: submitted.requestId,
          visibility: "PUBLIC",
          body: "Public status message",
        },
      ],
    });
    const details = await getOwnedRequestDetails(
      claimsA,
      submitted.requestId,
      db,
    );
    expect(
      details.ok &&
        details.request?.timeline.some(
          (entry) =>
            entry.kind === "message" && entry.body === "Public status message",
        ),
    ).toBe(true);
    expect(JSON.stringify(details)).not.toContain("Private STAFF note");
    const crossStudent = await getOwnedRequestDetails(
      claimsB,
      submitted.requestId,
      db,
    );
    expect(crossStudent).toEqual({ ok: true, request: null });
  });

  it("serializes concurrent duplicate submissions to one open request", async (context) => {
    const db = dbOrSkip(context);
    if (!db || !verified) return;
    const second = await verified.openIndependentConnection();
    try {
      const input = {
        categoryId: categoryIds.concurrent,
        copyCount: 1,
        details: "",
        deliveryMethod: "CAMPUS_PICKUP",
      };
      const results = await Promise.all([
        submitRequestAsActor(claimsA, input, db),
        submitRequestAsActor(claimsA, input, second),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(
        results.filter(
          (result) => !result.ok && result.reason === "DUPLICATE_OPEN_REQUEST",
        ),
      ).toHaveLength(1);
      expect(
        await db.documentRequest.count({
          where: {
            studentId: profileAId,
            categoryId: categoryIds.concurrent,
            status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "READY"] },
          },
        }),
      ).toBe(1);
    } finally {
      await verified.closeIndependentConnection(second);
    }
  });

  it("allows resubmission after terminal cancellation and keeps cancellation idempotent", async (context) => {
    const db = dbOrSkip(context);
    if (!db || !verified) return;
    const first = await submitRequestAsActor(
      claimsA,
      {
        categoryId: categoryIds.repeat,
        copyCount: 1,
        details: "",
        deliveryMethod: "CAMPUS_PICKUP",
      },
      db,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await verified.openIndependentConnection();
    try {
      await expect(
        cancelRequestAsActor(claimsB, { requestId: first.requestId }, second),
      ).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
      const results = await Promise.all([
        cancelRequestAsActor(claimsA, { requestId: first.requestId }, db),
        cancelRequestAsActor(claimsA, { requestId: first.requestId }, second),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(
        results.some(
          (result) => !result.ok && result.reason === "ALREADY_CANCELLED",
        ),
      ).toBe(true);
    } finally {
      await verified.closeIndependentConnection(second);
    }
    expect(
      await db.requestStatusHistory.count({
        where: { requestId: first.requestId, toStatus: "CANCELLED" },
      }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: {
          entityId: first.requestId,
          action: "STUDENT_REQUEST_CANCELLED",
        },
      }),
    ).toBe(1);
    const resubmitted = await submitRequestAsActor(
      claimsA,
      {
        categoryId: categoryIds.repeat,
        copyCount: 1,
        details: "",
        deliveryMethod: "DIGITAL_DELIVERY",
      },
      db,
    );
    expect(resubmitted.ok).toBe(true);
    if (resubmitted.ok) {
      await db.documentRequest.update({
        where: { id: resubmitted.requestId },
        data: { status: "UNDER_REVIEW" },
      });
      await expect(
        cancelRequestAsActor(claimsA, { requestId: resubmitted.requestId }, db),
      ).resolves.toEqual({ ok: false, reason: "STATUS_CONFLICT" });
    }
  });

  it("rolls back creation when required audit writing fails", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const before = await db.documentRequest.count({
      where: { studentId: profileBId, categoryId: categoryIds.rollback },
    });
    const rejectingAudit = db.$extends({
      query: {
        auditLog: {
          create() {
            throw new Error("controlled audit failure");
          },
        },
      },
    }) as unknown as PrismaClient;
    await expect(
      submitRequestAsActor(
        claimsB,
        {
          categoryId: categoryIds.rollback,
          copyCount: 1,
          details: "",
          deliveryMethod: "CAMPUS_PICKUP",
        },
        rejectingAudit,
      ),
    ).rejects.toThrow("controlled audit failure");
    expect(
      await db.documentRequest.count({
        where: { studentId: profileBId, categoryId: categoryIds.rollback },
      }),
    ).toBe(before);

    const cancellable = await submitRequestAsActor(
      claimsB,
      {
        categoryId: categoryIds.rollback,
        copyCount: 1,
        details: "",
        deliveryMethod: "DIGITAL_DELIVERY",
      },
      db,
    );
    expect(cancellable.ok).toBe(true);
    if (!cancellable.ok) return;
    await expect(
      cancelRequestAsActor(
        claimsB,
        { requestId: cancellable.requestId },
        rejectingAudit,
      ),
    ).rejects.toThrow("controlled audit failure");
    await expect(
      db.documentRequest.findUnique({
        where: { id: cancellable.requestId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "SUBMITTED" });
    expect(
      await db.requestStatusHistory.count({
        where: { requestId: cancellable.requestId, toStatus: "CANCELLED" },
      }),
    ).toBe(0);
  });

  it("denies stale and disabled actors and excludes cross-student dashboard/history data", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    await expect(
      getStudentDashboard(
        { actorId: studentAId, claimedSessionVersion: 9 },
        db,
      ),
    ).resolves.toEqual({ ok: false, reason: "STALE_SESSION" });
    await db.user.update({
      where: { id: studentBId },
      data: {
        status: "DISABLED",
        disabledAt: new Date("2000-01-01T00:00:00.000Z"),
        disabledById: studentBId,
      },
    });
    await expect(
      submitRequestAsActor(
        claimsB,
        {
          categoryId: categoryIds.standard,
          copyCount: 1,
          details: "",
          deliveryMethod: "CAMPUS_PICKUP",
        },
        db,
      ),
    ).resolves.toEqual({ ok: false, reason: "DISABLED_ACCOUNT" });
    await db.user.update({
      where: { id: studentBId },
      data: { status: "ACTIVE", disabledAt: null, disabledById: null },
    });
    const history = await listOwnedRequests(claimsA, { page: 1 }, db);
    expect(
      history.ok &&
        history.requests.every((request) => typeof request.id === "string"),
    ).toBe(true);
    const dashboard = await getStudentDashboard(claimsA, db);
    expect(dashboard.ok && dashboard.summary.total).toBe(
      await db.documentRequest.count({ where: { studentId: profileAId } }),
    );
    if (dashboard.ok) {
      expect(dashboard.recent.length).toBeLessThanOrEqual(5);
      expect(
        dashboard.recent.every(
          (request, index, requests) =>
            index === 0 ||
            (requests[index - 1]?.createdAt.getTime() ?? 0) >=
              request.createdAt.getTime(),
        ),
      ).toBe(true);
    }
    const categories = await listAvailableRequestCategories(claimsA, db);
    expect(
      categories.ok &&
        categories.categories.some(
          (category) => category.id === categoryIds.standard,
        ),
    ).toBe(true);
    await db.requestCategory.update({
      where: { id: categoryIds.standard },
      data: { isActive: false },
    });
    const unavailable = await listAvailableRequestCategories(claimsA, db);
    expect(
      unavailable.ok &&
        unavailable.categories.every(
          (category) => category.id !== categoryIds.standard,
        ),
    ).toBe(true);
    await db.requestCategory.update({
      where: { id: categoryIds.standard },
      data: { isActive: true },
    });
  });
});
