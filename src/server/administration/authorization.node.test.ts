// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  exportRequestsAsActor,
  exportStudentsAsActor,
} from "@/server/administration/exports.node";
import {
  createRequestCategoryAsActor,
  transitionRequestAsActor,
} from "@/server/administration/mutations.node";
import {
  getRequestDashboardCounts,
  listRequestCategories,
  listStaffRequests,
} from "@/server/administration/reads.node";
import {
  loadCapabilityActor,
  revalidateCapabilityActorInTransaction,
} from "@/server/auth/capabilities.node";

vi.mock("@/server/auth/capabilities.node", () => ({
  loadCapabilityActor: vi.fn(),
  revalidateCapabilityActorInTransaction: vi.fn(),
}));

const loadActor = vi.mocked(loadCapabilityActor);
const revalidateActor = vi.mocked(revalidateCapabilityActorInTransaction);
const claims = { actorId: "staff-id", claimedSessionVersion: 1 } as const;

function denied() {
  return { ok: false as const, reason: "MISSING_CAPABILITY" as const };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadActor.mockResolvedValue(denied());
  revalidateActor.mockResolvedValue(denied());
});

describe("V2-6 exact capability boundaries", () => {
  it.each([
    ["PROCESS_REQUESTS", getRequestDashboardCounts, []],
    ["PROCESS_REQUESTS", listStaffRequests, [{ page: 1 }]],
    ["MANAGE_REQUEST_CATEGORIES", listRequestCategories, []],
  ] as const)(
    "denies reads without %s before protected queries",
    async (capability, operation, inputs) => {
      const groupBy = vi.fn();
      const count = vi.fn();
      const findMany = vi.fn();
      const database = {
        documentRequest: { groupBy, count, findMany },
        requestCategory: { findMany },
      } as unknown as PrismaClient;
      const callable = operation as unknown as (
        ...arguments_: unknown[]
      ) => Promise<unknown>;
      const result = await callable(claims, ...inputs, database);
      expect(result).toEqual(denied());
      expect(loadActor).toHaveBeenCalledWith(claims, capability, database);
      expect(groupBy).not.toHaveBeenCalled();
      expect(count).not.toHaveBeenCalled();
      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["EXPORT_STUDENT_DATA", exportStudentsAsActor, { status: "all" }],
    ["EXPORT_REQUEST_DATA", exportRequestsAsActor, {}],
  ] as const)(
    "denies exports without %s before data queries",
    async (capability, operation, input) => {
      const findMany = vi.fn();
      const transaction = {
        user: { findMany },
        documentRequest: { findMany },
      };
      const database = {
        $transaction: vi.fn((callback) => callback(transaction)),
      } as unknown as PrismaClient;
      await expect(operation(claims, input, database)).resolves.toEqual(
        denied(),
      );
      expect(revalidateActor).toHaveBeenCalledWith(
        transaction,
        claims,
        capability,
      );
      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it("denies request transitions before locking or writing request data", async () => {
    const queryRaw = vi.fn();
    const updateMany = vi.fn();
    const transaction = {
      $queryRaw: queryRaw,
      documentRequest: { updateMany },
    };
    const database = {
      $transaction: vi.fn((callback) => callback(transaction)),
    } as unknown as PrismaClient;
    await expect(
      transitionRequestAsActor(
        claims,
        {
          requestId: "99600000-0000-4000-8000-000000000099",
          targetStatus: "UNDER_REVIEW",
        },
        database,
      ),
    ).resolves.toEqual(denied());
    expect(loadActor).toHaveBeenCalledWith(
      claims,
      "PROCESS_REQUESTS",
      database,
    );
    expect(database.$transaction).not.toHaveBeenCalled();
    expect(revalidateActor).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("denies category creation before category locking or writes", async () => {
    const queryRaw = vi.fn();
    const create = vi.fn();
    const transaction = { $queryRaw: queryRaw, requestCategory: { create } };
    const database = {
      $transaction: vi.fn((callback) => callback(transaction)),
    } as unknown as PrismaClient;
    await expect(
      createRequestCategoryAsActor(
        claims,
        { name: "Denied category", description: "" },
        database,
      ),
    ).resolves.toEqual(denied());
    expect(revalidateActor).toHaveBeenCalledWith(
      transaction,
      claims,
      "MANAGE_REQUEST_CATEGORIES",
    );
    expect(queryRaw).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
