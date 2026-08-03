// @vitest-environment node

import { randomUUID } from "node:crypto";

import dotenv from "dotenv";
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
  exportRequestsAsActor,
  exportStudentsAsActor,
} from "@/server/administration/exports.node";
import {
  addRequestMessageAsActor,
  createRequestCategoryAsActor,
  setRequestCategoryActiveAsActor,
  transitionRequestAsActor,
  updateRequestCategoryAsActor,
} from "@/server/administration/mutations.node";
import {
  getRequestDashboardCounts,
  getStaffRequestDetails,
  listStaffRequests,
} from "@/server/administration/reads.node";
import { cancelRequestAsActor } from "@/server/student-portal/mutations.node";
import {
  getOwnedRequestDetails,
  listAvailableRequestCategories,
} from "@/server/student-portal/reads.node";
import {
  openVerifiedIsolatedTestDatabase,
  type VerifiedIsolatedTestDatabase,
  type VerifiedTestDatabaseClient,
} from "@/test/isolated-database.node";

dotenv.config({ path: ".env.local", quiet: true });

const staffId = "99600000-0000-4000-8000-000000000001";
const studentId = "99600000-0000-4000-8000-000000000002";
const profileId = "99600000-0000-4000-8000-000000000003";
const categoryId = "99600000-0000-4000-8000-000000000004";
const staffClaims = { actorId: staffId, claimedSessionVersion: 0 } as const;
const studentClaims = { actorId: studentId, claimedSessionVersion: 0 } as const;
let verified: VerifiedIsolatedTestDatabase | undefined;
let database: VerifiedTestDatabaseClient | undefined;

function dbOrSkip(context: TestContext) {
  if (database) return database;
  context.skip(
    "V2-6 PostgreSQL integration requires the verified isolated test database.",
  );
}

async function createRequest(
  db: VerifiedTestDatabaseClient,
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "READY" = "SUBMITTED",
) {
  const request = await db.documentRequest.create({
    data: {
      id: randomUUID(),
      studentId: profileId,
      categoryId,
      status,
      deliveryMethod: "CAMPUS_PICKUP",
      copyCount: 1,
      details: "V2-6 suite-owned request detail",
    },
    select: { id: true },
  });
  await db.requestStatusHistory.create({
    data: {
      requestId: request.id,
      fromStatus: null,
      toStatus: status,
      changedById: studentId,
    },
  });
  return request.id;
}

function databaseWithAuditFailure(db: PrismaClient): PrismaClient {
  return db.$extends({
    query: {
      auditLog: {
        create() {
          throw new Error("controlled V2-6 audit failure");
        },
      },
    },
  }) as unknown as PrismaClient;
}

beforeAll(async () => {
  try {
    verified = await openVerifiedIsolatedTestDatabase(process.env);
  } catch {
    return;
  }
  database = verified.database;
  await database.user.upsert({
    where: { id: staffId },
    create: {
      id: staffId,
      email: "v2-6-staff@example.test",
      fullName: "V2-6 Test Staff",
      passwordHash: "suite-owned-non-authenticating-value",
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 0,
    },
    update: { role: "STAFF", status: "ACTIVE", sessionVersion: 0 },
  });
  await database.user.upsert({
    where: { id: studentId },
    create: {
      id: studentId,
      email: "v2-6-student@example.test",
      fullName: "=V2-6 Formula Student",
      passwordHash: "suite-owned-non-authenticating-value",
      role: "STUDENT",
      status: "ACTIVE",
      sessionVersion: 0,
    },
    update: {
      email: "v2-6-student@example.test",
      fullName: "=V2-6 Formula Student",
      role: "STUDENT",
      status: "ACTIVE",
      sessionVersion: 0,
    },
  });
  await database.studentProfile.upsert({
    where: { id: profileId },
    create: {
      id: profileId,
      userId: studentId,
      studentNumber: "V26TEST001",
      program: "V2-6 Test Programme",
      academicYear: "YEAR_2",
    },
    update: {
      userId: studentId,
      studentNumber: "V26TEST001",
      program: "V2-6 Test Programme",
      academicYear: "YEAR_2",
    },
  });
  await database.requestCategory.upsert({
    where: { id: categoryId },
    create: {
      id: categoryId,
      name: "V2-6 Processing Category",
      slug: "v2-6-processing-category",
      description: "Suite-owned category",
      isActive: true,
    },
    update: { isActive: true },
  });
  await database.userCapabilityAssignment.createMany({
    data: [
      "PROCESS_REQUESTS",
      "MANAGE_REQUEST_CATEGORIES",
      "EXPORT_STUDENT_DATA",
      "EXPORT_REQUEST_DATA",
    ].map((capability) => ({
      userId: staffId,
      capability: capability as
        | "PROCESS_REQUESTS"
        | "MANAGE_REQUEST_CATEGORIES"
        | "EXPORT_STUDENT_DATA"
        | "EXPORT_REQUEST_DATA",
      grantedById: null,
    })),
    skipDuplicates: true,
  });
});

afterAll(async () => {
  await verified?.close();
});

describe.sequential("V2-6 PostgreSQL administration workflows", () => {
  it("reports database-backed counts and a stable filtered 25-row queue", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const requestId = await createRequest(db);
    const counts = await getRequestDashboardCounts(staffClaims, db);
    expect(counts.ok).toBe(true);
    if (counts.ok) expect(counts.counts.SUBMITTED).toBeGreaterThan(0);
    const queue = await listStaffRequests(
      staffClaims,
      { page: 1, categoryId, reference: "req-", student: "V26TEST001" },
      db,
    );
    expect(queue.ok).toBe(true);
    if (queue.ok) {
      expect(queue.requests.length).toBeLessThanOrEqual(25);
      expect(queue.requests.some((request) => request.id === requestId)).toBe(
        true,
      );
      expect(queue.requests).toEqual(
        [...queue.requests].sort(
          (left, right) =>
            right.createdAt.getTime() - left.createdAt.getTime() ||
            right.id.localeCompare(left.id),
        ),
      );
    }
  });

  it("executes every approved transition and writes one history and audit per step", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const requestId = await createRequest(db);
    for (const targetStatus of [
      "UNDER_REVIEW",
      "APPROVED",
      "READY",
      "COMPLETED",
    ] as const) {
      await expect(
        transitionRequestAsActor(staffClaims, { requestId, targetStatus }, db),
      ).resolves.toEqual({ ok: true });
    }
    await expect(
      transitionRequestAsActor(
        staffClaims,
        { requestId, targetStatus: "READY" },
        db,
      ),
    ).resolves.toEqual({ ok: false, reason: "STATUS_CONFLICT" });
    const stored = await db.documentRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { statusHistory: true },
    });
    expect(stored.status).toBe("COMPLETED");
    expect(stored.statusHistory).toHaveLength(5);
    await expect(
      db.auditLog.count({
        where: { entityId: requestId, action: "REQUEST_STATUS_CHANGED" },
      }),
    ).resolves.toBe(4);
  });

  it("requires rejection reason and keeps internal communication out of student reads", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const requestId = await createRequest(db);
    await expect(
      transitionRequestAsActor(
        staffClaims,
        { requestId, targetStatus: "REJECTED" },
        db,
      ),
    ).resolves.toEqual({ ok: false, reason: "INVALID_INPUT" });
    await expect(
      transitionRequestAsActor(
        staffClaims,
        {
          requestId,
          targetStatus: "REJECTED",
          rejectionReason: "Required document was not supplied.",
          internalNote: "Internal verification detail",
          publicMessage: "Please submit a new request when ready.",
        },
        db,
      ),
    ).resolves.toEqual({ ok: true });
    const staffDetails = await getStaffRequestDetails(
      staffClaims,
      requestId,
      db,
    );
    expect(
      staffDetails.ok &&
        staffDetails.request?.timeline.some(
          (event) =>
            event.kind === "message" && event.visibility === "INTERNAL",
        ),
    ).toBe(true);
    const studentDetails = await getOwnedRequestDetails(
      studentClaims,
      requestId,
      db,
    );
    expect(studentDetails.ok).toBe(true);
    if (studentDetails.ok && studentDetails.request) {
      const serialized = JSON.stringify(studentDetails.request);
      expect(serialized).not.toContain("Internal verification detail");
      expect(serialized).toContain("Request rejected:");
      expect(serialized).toContain("Please submit a new request");
      expect(serialized).not.toContain(staffId);
    }
  });

  it("adds independently audited internal and public messages", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const requestId = await createRequest(db);
    await expect(
      addRequestMessageAsActor(
        staffClaims,
        { requestId, visibility: "INTERNAL", body: "Internal note" },
        db,
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      addRequestMessageAsActor(
        staffClaims,
        { requestId, visibility: "PUBLIC", body: "Public update" },
        db,
      ),
    ).resolves.toEqual({ ok: true });
    const actions = await db.auditLog.findMany({
      where: {
        entityId: requestId,
        action: {
          in: ["REQUEST_INTERNAL_NOTE_ADDED", "REQUEST_PUBLIC_MESSAGE_ADDED"],
        },
      },
      orderBy: { action: "asc" },
      select: { action: true },
    });
    expect(actions.map(({ action }) => action).sort()).toEqual([
      "REQUEST_INTERNAL_NOTE_ADDED",
      "REQUEST_PUBLIC_MESSAGE_ADDED",
    ]);
  });

  it("serializes STAFF processing against student cancellation", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const requestId = await createRequest(db);
    const independent = await openVerifiedIsolatedTestDatabase(process.env);
    try {
      const results = await Promise.all([
        transitionRequestAsActor(
          staffClaims,
          { requestId, targetStatus: "UNDER_REVIEW" },
          db,
        ),
        cancelRequestAsActor(
          studentClaims,
          { requestId },
          independent.database,
        ),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toHaveLength(1);
      await expect(
        db.requestStatusHistory.count({ where: { requestId } }),
      ).resolves.toBe(2);
    } finally {
      await independent.close();
    }
  });

  it("rolls back transitions and exports when required audit creation fails", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const requestId = await createRequest(db);
    const failing = databaseWithAuditFailure(db);
    await expect(
      transitionRequestAsActor(
        staffClaims,
        { requestId, targetStatus: "UNDER_REVIEW" },
        failing,
      ),
    ).rejects.toThrow("controlled V2-6 audit failure");
    await expect(
      db.documentRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "SUBMITTED" });
    await expect(
      exportRequestsAsActor(staffClaims, {}, failing),
    ).rejects.toThrow("controlled V2-6 audit failure");
  });

  it("manages category lifecycle without changing its generated slug or history", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const suffix = randomUUID().slice(0, 8);
    const name = `V2-6 Suite Category ${suffix}`;
    await expect(
      createRequestCategoryAsActor(
        staffClaims,
        { name, description: "Created by V2-6 suite" },
        db,
      ),
    ).resolves.toEqual({ ok: true });
    const created = await db.requestCategory.findFirstOrThrow({
      where: { name },
    });
    await expect(
      updateRequestCategoryAsActor(
        staffClaims,
        {
          categoryId: created.id,
          name: `${name} Updated`,
          description: "Updated",
        },
        db,
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      setRequestCategoryActiveAsActor(
        staffClaims,
        { categoryId: created.id, isActive: false },
        db,
      ),
    ).resolves.toEqual({ ok: true });
    const stored = await db.requestCategory.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored).toMatchObject({ slug: created.slug, isActive: false });
    const available = await listAvailableRequestCategories(studentClaims, db);
    expect(
      available.ok &&
        available.categories.some((category) => category.id === created.id),
    ).toBe(false);
  });

  it("exports exact allowlists, active filters, UTF-8, formula safety, and redacted audits", async (context) => {
    const db = dbOrSkip(context);
    if (!db) return;
    const requestId = await createRequest(db);
    const students = await exportStudentsAsActor(
      staffClaims,
      { search: "V26TEST001", status: "active" },
      db,
    );
    expect(students.ok).toBe(true);
    if (students.ok) {
      expect(students.rowCount).toBe(1);
      expect(students.body.split("\r\n")[0]).toBe(
        '"Full name","Email","Student number","Program","Academic year","Account status"',
      );
      expect(students.body).toContain("'=V2-6 Formula Student");
      expect(students.body).not.toContain("passwordHash");
      expect(
        new TextDecoder("utf-8", { fatal: true }).decode(
          new TextEncoder().encode(students.body),
        ),
      ).toBe(students.body);
    }
    const requests = await exportRequestsAsActor(
      staffClaims,
      { categoryId, student: "V26TEST001" },
      db,
    );
    expect(requests.ok).toBe(true);
    if (requests.ok) {
      expect(requests.body).toContain(
        '"Request reference","Student number","Category name","Status","Delivery method","Copy count","Submitted timestamp","Updated timestamp"',
      );
      expect(requests.body).not.toContain("V2-6 suite-owned request detail");
    }
    const audit = await db.auditLog.findFirstOrThrow({
      where: { actorId: staffId, action: "REQUEST_DATA_EXPORTED" },
      orderBy: { createdAt: "desc" },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain(requestId);
    expect(JSON.stringify(audit.metadata)).not.toContain(
      "suite-owned request detail",
    );
  });
});
