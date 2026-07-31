// @vitest-environment node

import path from "node:path";

import dotenv from "dotenv";
import { afterAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/server/db/factory.node";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
  quiet: true,
});

const runtimeDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runtimeClient = runtimeDatabaseUrl
  ? createPrismaClient(runtimeDatabaseUrl)
  : undefined;
const isolatedClient = testDatabaseUrl
  ? createPrismaClient(testDatabaseUrl)
  : undefined;

afterAll(async () => {
  await runtimeClient?.$disconnect();
  await isolatedClient?.$disconnect();
});

describe.skipIf(true)(
  "seeded development database (requires applied Phase 3 migration)",
  () => {
    it("reads the expected development fixtures without mutating data", async () => {
      const [staffCount, studentCount, profileCount, historyCount] =
        await Promise.all([
          runtimeClient!.user.count({ where: { role: "STAFF" } }),
          runtimeClient!.user.count({ where: { role: "STUDENT" } }),
          runtimeClient!.studentProfile.count(),
          runtimeClient!.requestStatusHistory.count(),
        ]);

      expect(staffCount).toBeGreaterThanOrEqual(1);
      expect(studentCount).toBeGreaterThanOrEqual(2);
      expect(profileCount).toBeGreaterThanOrEqual(2);
      expect(historyCount).toBeGreaterThanOrEqual(3);

      const messages = await runtimeClient!.requestMessage.findMany({
        where: {
          id: {
            in: [
              "60000000-0000-4000-8000-000000000001",
              "60000000-0000-4000-8000-000000000002",
            ],
          },
        },
        select: { visibility: true },
      });

      expect(
        messages.map((message) => message.visibility).sort(),
      ).toStrictEqual(["INTERNAL", "PUBLIC"]);

      const requests = await runtimeClient!.documentRequest.findMany({
        where: {
          id: {
            in: [
              "40000000-0000-4000-8000-000000000001",
              "40000000-0000-4000-8000-000000000002",
            ],
          },
        },
        select: { referenceNumber: true },
      });

      expect(requests).toHaveLength(2);
      for (const request of requests) {
        expect(request.referenceNumber).toMatch(/^REQ-\d{8,}$/u);
      }
    });

    it("reads the applied sequence, constraint, and append-only triggers", async () => {
      const sequence = await runtimeClient!.$queryRaw<
        Array<{ exists: boolean }>
      >`
      SELECT to_regclass('public.document_request_reference_seq') IS NOT NULL AS "exists"
    `;
      const constraint = await runtimeClient!.$queryRaw<
        Array<{ definition: string }>
      >`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'DocumentRequest_copyCount_check'
    `;
      const triggers = await runtimeClient!.$queryRaw<Array<{ name: string }>>`
      SELECT tgname AS name
      FROM pg_trigger
      WHERE tgname IN ('RequestStatusHistory_append_only', 'AuditLog_append_only')
        AND NOT tgisinternal
      ORDER BY tgname
    `;

      expect(sequence).toStrictEqual([{ exists: true }]);
      expect(constraint.at(0)?.definition).toContain('"copyCount" > 0');
      expect(triggers.map((trigger) => trigger.name)).toStrictEqual([
        "AuditLog_append_only",
        "RequestStatusHistory_append_only",
      ]);
    });
  },
);

describe.skipIf(!isolatedClient)("isolated test database", () => {
  it("connects without modifying data", async () => {
    const result = await isolatedClient!.$queryRaw<
      Array<{ connected: number }>
    >`
      SELECT 1 AS connected
    `;

    expect(result).toStrictEqual([{ connected: 1 }]);
  });
});
