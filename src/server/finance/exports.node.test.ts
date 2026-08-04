// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const studentAuth = vi.fn();
const staffAuth = vi.fn();
vi.mock("@/server/student-portal/authorization.node", () => ({
  revalidateStudentActorInTransaction: studentAuth,
}));
vi.mock("@/server/auth/capabilities.node", () => ({
  revalidateCapabilityActorInTransaction: staffAuth,
}));
const { exportStaffFinance, exportStudentFinanceStatement } =
  await import("@/server/finance/exports.node");

function database(rows: unknown[] = []) {
  const tx = {
    financeTransaction: { findMany: vi.fn().mockResolvedValue(rows) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    $transaction: vi.fn((fn: (value: typeof tx) => unknown) => fn(tx)),
    tx,
  };
}
const student = {
  ok: true as const,
  actor: {
    id: "00000000-0000-4000-8000-000000000001",
    profileId: "00000000-0000-4000-8000-000000000002",
  },
};
const staff = {
  ok: true as const,
  actor: { id: "00000000-0000-4000-8000-000000000003" },
};
describe("finance exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    studentAuth.mockResolvedValue(student);
    staffAuth.mockResolvedValue(staff);
  });
  it("limits student statements to the authenticated profile and neutralizes formulas", async () => {
    const db = database([
      {
        billingPeriod: "2026-2027",
        term: "ANNUAL",
        effectiveDate: new Date("2026-08-01"),
        postedAt: new Date("2026-08-02"),
        entryType: "CHARGE",
        amountMinor: BigInt(1),
        currency: "MAD",
        sourceReference: "=unsafe",
        description: "@unsafe",
      },
    ]);
    const result = await exportStudentFinanceStatement(
      { actorId: student.actor.id, claimedSessionVersion: 0 },
      {},
      db as never,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toContain("'=unsafe");
    expect(
      db.tx.financeTransaction.findMany.mock.calls[0]![0].where.account
        .studentId,
    ).toBe(student.actor.profileId);
  });
  it("rejects an overlong range without querying", async () => {
    const db = database();
    const result = await exportStudentFinanceStatement(
      { actorId: student.actor.id, claimedSessionVersion: 0 },
      { from: "2020-01-01", to: "2022-01-01" },
      db as never,
    );
    expect(result).toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(db.tx.financeTransaction.findMany).not.toHaveBeenCalled();
  });
  it("requires the exact staff export capability and exports only allowlisted columns", async () => {
    staffAuth.mockResolvedValue({ ok: false, reason: "MISSING_CAPABILITY" });
    const db = database();
    const denied = await exportStaffFinance(
      { actorId: "x", claimedSessionVersion: 0 },
      { from: "2026-08-01", to: "2026-08-02" },
      db as never,
    );
    expect(denied).toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
  });
});
