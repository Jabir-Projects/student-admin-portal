// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidate = vi.fn();
vi.mock("@/server/auth/capabilities.node", () => ({
  loadCapabilityActor: vi.fn(),
  revalidateCapabilityActorInTransaction: revalidate,
}));
const { reverseFinanceTransactionAsActor } =
  await import("@/server/finance/workflow.node");

const claims = { actorId: "staff", claimedSessionVersion: 0 };
function database(original: unknown = null) {
  const transaction = {
    $queryRaw: vi.fn(),
    financeTransaction: {
      findUnique: vi.fn().mockResolvedValue(original),
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    notification: { upsert: vi.fn() },
  };
  return {
    $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
    transaction,
  };
}

describe("finance reversals", () => {
  beforeEach(() => vi.clearAllMocks());
  it("requires FINANCE_IMPORT_APPROVE before reading a transaction", async () => {
    const db = database();
    revalidate.mockResolvedValue({ ok: false, reason: "MISSING_CAPABILITY" });
    await expect(
      reverseFinanceTransactionAsActor(
        claims,
        {
          transactionId: "00000000-0000-4000-8000-000000000010",
          reason: "Corrected entry",
        },
        db as never,
      ),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
    expect(db.transaction.financeTransaction.findUnique).not.toHaveBeenCalled();
  });
  it("does not reverse a transaction when the submitted student differs from its authoritative account", async () => {
    const db = database({
      id: "00000000-0000-4000-8000-000000000010",
      accountId: "account",
      entryType: "CHARGE",
      account: {
        student: {
          id: "00000000-0000-4000-8000-000000000011",
          userId: "student-user",
        },
      },
      reversal: null,
    });
    revalidate.mockResolvedValue({ ok: true, actor: { id: "staff" } });
    await expect(
      reverseFinanceTransactionAsActor(
        claims,
        {
          transactionId: "00000000-0000-4000-8000-000000000010",
          studentId: "00000000-0000-4000-8000-000000000012",
          reason: "Corrected entry",
        },
        db as never,
      ),
    ).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(db.transaction.financeTransaction.create).not.toHaveBeenCalled();
  });
});
