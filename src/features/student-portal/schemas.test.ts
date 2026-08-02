import { describe, expect, it } from "vitest";

import {
  requestHistoryQuerySchema,
  submitRequestInputSchema,
  TERMINAL_REQUEST_STATUSES,
} from "@/features/student-portal/schemas";

const categoryId = "10000000-0000-4000-8000-000000000001";

describe("student portal schemas", () => {
  it.each(["CAMPUS_PICKUP", "DIGITAL_DELIVERY"])(
    "accepts the approved %s delivery method",
    (deliveryMethod) => {
      expect(
        submitRequestInputSchema.parse({
          categoryId,
          copyCount: "1",
          details: "  ",
          deliveryMethod,
        }),
      ).toEqual({ categoryId, copyCount: 1, details: null, deliveryMethod });
    },
  );

  it.each([undefined, "POSTAL_MAIL", ""])(
    "rejects unsupported delivery %s",
    (deliveryMethod) => {
      expect(
        submitRequestInputSchema.safeParse({
          categoryId,
          copyCount: 1,
          details: "",
          deliveryMethod,
        }).success,
      ).toBe(false);
    },
  );

  it.each([1, 5])("accepts copy count %s", (copyCount) => {
    expect(
      submitRequestInputSchema.safeParse({
        categoryId,
        copyCount,
        details: "",
        deliveryMethod: "CAMPUS_PICKUP",
      }).success,
    ).toBe(true);
  });

  it.each([0, 6, 1.5])("rejects copy count %s", (copyCount) => {
    expect(
      submitRequestInputSchema.safeParse({
        categoryId,
        copyCount,
        details: "",
        deliveryMethod: "CAMPUS_PICKUP",
      }).success,
    ).toBe(false);
  });

  it("rejects details over 1000 characters", () => {
    expect(
      submitRequestInputSchema.safeParse({
        categoryId,
        copyCount: 1,
        details: "x".repeat(1001),
        deliveryMethod: "CAMPUS_PICKUP",
      }).success,
    ).toBe(false);
  });

  it("uses the documented terminal status set", () => {
    expect(TERMINAL_REQUEST_STATUSES).toEqual([
      "REJECTED",
      "COMPLETED",
      "CANCELLED",
    ]);
  });

  it("normalizes invalid history queries safely", () => {
    expect(
      requestHistoryQuerySchema.parse({ page: "-2", status: "UNKNOWN" }),
    ).toEqual({ page: 1 });
  });
});
