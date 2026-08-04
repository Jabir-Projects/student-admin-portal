// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const loadActor = vi.fn();
const studentActor = vi.fn();
vi.mock("@/server/auth/capabilities.node", () => ({
  loadCapabilityActor: loadActor,
}));
vi.mock("@/server/student-portal/authorization.node", () => ({
  authorizeStudentActor: studentActor,
}));

const { readStaffStudentFinance, readStudentFinance, searchStaffFinance } =
  await import("@/server/finance/reads.node");

const claims = { actorId: "actor", claimedSessionVersion: 0 };
const staff = {
  ok: true as const,
  actor: {
    id: "staff",
    role: "STAFF" as const,
    status: "ACTIVE" as const,
    sessionVersion: 0,
    capabilities: ["VIEW_FINANCE"],
  },
};
const student = {
  ok: true as const,
  actor: {
    id: "student-user",
    profileId: "00000000-0000-4000-8000-000000000001",
  },
};
function database() {
  return {
    studentProfile: { findUnique: vi.fn(), findMany: vi.fn() },
    studentFinanceAccount: { findUnique: vi.fn() },
  };
}

describe("finance authoritative reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadActor.mockResolvedValue(staff);
    studentActor.mockResolvedValue(student);
  });
  it("limits student finance to the authenticated student profile", async () => {
    const db = database();
    db.studentFinanceAccount.findUnique.mockResolvedValue({ transactions: [] });
    await readStudentFinance(claims, db as never);
    expect(db.studentFinanceAccount.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: student.actor.profileId },
      }),
    );
  });
  it("denies staff searches without VIEW_FINANCE before any finance read", async () => {
    const db = database();
    loadActor.mockResolvedValue({ ok: false, reason: "MISSING_CAPABILITY" });
    await expect(
      searchStaffFinance(claims, "SIST", db as never),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
    expect(db.studentProfile.findMany).not.toHaveBeenCalled();
  });
  it("uses the authoritative student ID for staff detail and rejects forged IDs safely", async () => {
    const db = database();
    await expect(
      readStaffStudentFinance(claims, "forged", db as never),
    ).resolves.toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(loadActor).not.toHaveBeenCalled();
    db.studentProfile.findUnique.mockResolvedValue(null);
    await expect(
      readStaffStudentFinance(
        claims,
        "00000000-0000-4000-8000-000000000002",
        db as never,
      ),
    ).resolves.toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(db.studentProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "00000000-0000-4000-8000-000000000002" },
      }),
    );
  });
  it("calculates search balances from posted ledger effects", async () => {
    const db = database();
    db.studentProfile.findMany.mockResolvedValue([
      {
        id: "student",
        studentNumber: "SIST-1",
        financeAccount: {
          transactions: [
            { ledgerEffectMinor: BigInt(200) },
            { ledgerEffectMinor: BigInt(-50) },
          ],
        },
      },
    ]);
    const result = await searchStaffFinance(claims, "  SIST-1  ", db as never);
    expect(result).toMatchObject({
      ok: true,
      students: [{ id: "student", balanceMinor: BigInt(150) }],
    });
    expect(db.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentNumber: { contains: "SIST-1", mode: "insensitive" } },
      }),
    );
  });
});
