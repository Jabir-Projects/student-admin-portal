import { describe, expect, it } from "vitest";

import {
  createRequestCategoryInputSchema,
  requestMessageInputSchema,
  requestQueueQuerySchema,
  requestTransitionInputSchema,
} from "@/features/administration/schemas";

describe("V2-6 administration schemas", () => {
  it("normalizes bounded request filters", () => {
    expect(
      requestQueueQuerySchema.parse({
        page: "2",
        reference: "  req-10  ",
        student: "  Test   Student  ",
      }),
    ).toEqual({
      page: 2,
      reference: "req-10",
      student: "Test Student",
    });
  });

  it.each([
    { page: 0 },
    { page: "not-a-page" },
    { status: "OPEN" },
    { reference: "x".repeat(65) },
    { student: "x".repeat(101) },
  ])("rejects malformed queue input %#", (input) => {
    expect(requestQueueQuerySchema.safeParse(input).success).toBe(false);
  });

  it("normalizes optional transition communication", () => {
    expect(
      requestTransitionInputSchema.parse({
        requestId: "98600000-0000-4000-8000-000000000001",
        targetStatus: "UNDER_REVIEW",
        rejectionReason: "",
        internalNote: "  private note  ",
        publicMessage: "  public update  ",
      }),
    ).toMatchObject({
      rejectionReason: undefined,
      internalNote: "private note",
      publicMessage: "public update",
    });
  });

  it("enforces different public and internal message limits", () => {
    const base = {
      requestId: "98600000-0000-4000-8000-000000000001",
      body: "x".repeat(1001),
    };
    expect(
      requestMessageInputSchema.safeParse({ ...base, visibility: "PUBLIC" })
        .success,
    ).toBe(false);
    expect(
      requestMessageInputSchema.safeParse({ ...base, visibility: "INTERNAL" })
        .success,
    ).toBe(true);
  });

  it("normalizes category fields without accepting a client slug", () => {
    expect(
      createRequestCategoryInputSchema.safeParse({
        name: "  Enrollment   Letter ",
        description: "  For current enrollment.  ",
        slug: "privileged-client-slug",
      }).success,
    ).toBe(false);
    expect(
      createRequestCategoryInputSchema.parse({
        name: "  Enrollment   Letter ",
        description: "  For current enrollment.  ",
      }),
    ).toEqual({
      name: "Enrollment Letter",
      description: "For current enrollment.",
    });
  });
});
