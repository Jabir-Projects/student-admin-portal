// @vitest-environment node

import path from "node:path";

import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  hasPackageBTestDatabaseConfiguration,
  tryOpenPackageBTestDatabase,
  type VerifiedPackageBTestDatabase,
  type VerifiedPackageBTestDatabaseClient,
} from "@/test/package-b-test-database.node";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
  quiet: true,
});

const hasSafeIsolatedDatabase = hasPackageBTestDatabaseConfiguration(
  process.env,
);
let verifiedDatabase: VerifiedPackageBTestDatabase | undefined;
let isolatedClient: VerifiedPackageBTestDatabaseClient | undefined;

beforeAll(async () => {
  if (!hasSafeIsolatedDatabase) return;
  const readiness = await tryOpenPackageBTestDatabase(process.env);
  if (!readiness.ready) return;
  verifiedDatabase = readiness.verified;
  isolatedClient = readiness.verified.database;
});

afterAll(async () => {
  await verifiedDatabase?.close();
});

describe.skipIf(!hasSafeIsolatedDatabase)("isolated test database", () => {
  it("reads the converted STAFF fixture baseline without mutating data", async () => {
    const users = await isolatedClient!.user.findMany({
      where: {
        id: {
          in: [
            "10000000-0000-4000-8000-000000000001",
            "95000000-0000-4000-8000-000000000001",
          ],
        },
      },
      orderBy: { id: "asc" },
      select: {
        id: true,
        role: true,
        status: true,
        sessionVersion: true,
        capabilityAssignments: {
          orderBy: { capability: "asc" },
          select: { capability: true },
        },
      },
    });

    expect(users).toStrictEqual([
      {
        id: "10000000-0000-4000-8000-000000000001",
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 1,
        capabilityAssignments: [
          { capability: "MANAGE_STUDENT_ACCOUNTS" },
          { capability: "REACTIVATE_STUDENT_ACCOUNTS" },
          { capability: "MANAGE_STAFF_ACCOUNTS" },
          { capability: "MANAGE_STAFF_CAPABILITIES" },
        ],
      },
      {
        id: "95000000-0000-4000-8000-000000000001",
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 1,
        capabilityAssignments: [
          { capability: "MANAGE_STUDENT_ACCOUNTS" },
          { capability: "REACTIVATE_STUDENT_ACCOUNTS" },
        ],
      },
    ]);

    const roleLabels = await isolatedClient!.$queryRaw<Array<{ role: string }>>`
      SELECT enumlabel AS role
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'UserRole'
      ORDER BY enumsortorder
    `;
    expect(roleLabels).toStrictEqual([{ role: "STUDENT" }, { role: "STAFF" }]);
  });

  it("reads the applied sequence, constraint, and append-only triggers", async () => {
    const sequence = await isolatedClient!.$queryRaw<
      Array<{ exists: boolean }>
    >`
      SELECT to_regclass('public.document_request_reference_seq') IS NOT NULL AS "exists"
    `;
    const constraint = await isolatedClient!.$queryRaw<
      Array<{ definition: string }>
    >`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'DocumentRequest_copyCount_check'
    `;
    const triggers = await isolatedClient!.$queryRaw<Array<{ name: string }>>`
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

  it("connects without modifying data", async () => {
    const result = await isolatedClient!.$queryRaw<
      Array<{ connected: number }>
    >`
      SELECT 1 AS connected
    `;

    expect(result).toStrictEqual([{ connected: 1 }]);
  });
});
