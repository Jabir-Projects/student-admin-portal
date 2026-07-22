import { describe, expect, it } from "vitest";

import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";
import {
  normalizeFullName,
  normalizeFullNameComparisonKey,
} from "@/features/auth/normalization";
import {
  studentRegistryEmailSchema,
  studentRegistryEntrySchema,
  studentRegistryFullNameSchema,
  studentRegistryStudentNumberSchema,
} from "@/features/student-registry/schemas";

const validEntry = {
  studentNumber: "SIST-123",
  fullName: "Student Applicant",
  email: "student@example.com",
  program: PROGRAMS[0],
  academicYear: ACADEMIC_YEARS[0].value,
};

describe("Student Registry email validation", () => {
  it("trims and lowercases valid addresses without rewriting dots or plus tags", () => {
    expect(
      studentRegistryEmailSchema.parse(" First.Last+Registry@EXAMPLE.COM "),
    ).toBe("first.last+registry@example.com");
  });

  it("rejects invalid and overlong addresses", () => {
    const overlongEmail = `${"a".repeat(309)}@example.com`;
    const invalid = studentRegistryEmailSchema.safeParse("invalid");
    const overlong = studentRegistryEmailSchema.safeParse(overlongEmail);

    expect(invalid.success).toBe(false);
    expect(overlong.success).toBe(false);
  });
});

describe("Student Registry Student Number validation", () => {
  it("trims, uppercases, permits approved punctuation, and requires no prefix", () => {
    const punctuated =
      studentRegistryStudentNumberSchema.parse(" ab.12_3/4-5 ");
    const noPrefix = studentRegistryStudentNumberSchema.parse("12345");

    expect(punctuated).toBe("AB.12_3/4-5");
    expect(noPrefix).toBe("12345");
  });

  it("accepts exactly 50 approved characters and rejects longer values", () => {
    const maximumLength = studentRegistryStudentNumberSchema.parse(
      "A".repeat(50),
    );
    const overlong = studentRegistryStudentNumberSchema.safeParse(
      "A".repeat(51),
    );

    expect(maximumLength).toHaveLength(50);
    expect(overlong.success).toBe(false);
  });

  it.each(["AB 12", "AB\u000012", "ＡB12", "ſ123", "AB@12"])(
    "rejects unsafe value %j",
    (value) => {
      const result = studentRegistryStudentNumberSchema.safeParse(value);

      expect(result.success).toBe(false);
    },
  );
});

describe("Student Registry full-name normalization", () => {
  it("normalizes NFC, trims, and collapses Unicode whitespace", () => {
    const normalized = normalizeFullName("  Jose\u0301\u00a0\t  Silva  ");
    const displayName =
      studentRegistryFullNameSchema.parse("  Ada\n Lovelace ");

    expect(normalized).toBe("José Silva");
    expect(displayName).toBe("Ada Lovelace");
  });

  it("creates a deterministic lowercase comparison key", () => {
    const comparisonKey = normalizeFullNameComparisonKey("  ÉLODIE   MARTIN ");

    expect(comparisonKey).toBe("élodie martin");
  });

  it("preserves accents, apostrophes, hyphens, and meaningful punctuation", () => {
    const name = "Élodie O’Connor-Smith, Jr.";
    const comparisonKey = normalizeFullNameComparisonKey(name);
    const withoutAccent = normalizeFullNameComparisonKey(
      "Elodie O’Connor-Smith, Jr.",
    );

    expect(normalizeFullName(name)).toBe(name);
    expect(comparisonKey).toBe("élodie o’connor-smith, jr.");
    expect(withoutAccent).not.toBe(comparisonKey);
  });
});

describe("Student Registry entry validation", () => {
  it.each(PROGRAMS)("accepts the exact approved program %s", (program) => {
    const result = studentRegistryEntrySchema.safeParse({
      ...validEntry,
      program,
    });

    expect(result.success).toBe(true);
  });

  it.each(ACADEMIC_YEARS)(
    "accepts the exact approved academic year $value",
    ({ value }) => {
      const result = studentRegistryEntrySchema.safeParse({
        ...validEntry,
        academicYear: value,
      });

      expect(result.success).toBe(true);
    },
  );

  it("rejects unknown programs, academic years, and object fields", () => {
    const unknownProgram = studentRegistryEntrySchema.safeParse({
      ...validEntry,
      program: "Unofficial Program",
    });
    const unknownAcademicYear = studentRegistryEntrySchema.safeParse({
      ...validEntry,
      academicYear: "YEAR_4",
    });
    const unexpectedField = studentRegistryEntrySchema.safeParse({
      ...validEntry,
      role: "ADMIN",
    });

    expect(unknownProgram.success).toBe(false);
    expect(unknownAcademicYear.success).toBe(false);
    expect(unexpectedField.success).toBe(false);
  });

  it("returns normalized storage and comparison values", () => {
    const result = studentRegistryEntrySchema.parse({
      ...validEntry,
      studentNumber: " sist/123 ",
      fullName: "  ÉLODIE\u00a0MARTIN ",
      email: " Student+Registry@Example.COM ",
    });

    expect(result).toEqual({
      ...validEntry,
      studentNumber: "SIST/123",
      fullName: "ÉLODIE MARTIN",
      normalizedFullName: "élodie martin",
      email: "student+registry@example.com",
    });
  });

  it("rejects a derived comparison key longer than the database limit", () => {
    const result = studentRegistryEntrySchema.safeParse({
      ...validEntry,
      fullName: "İ".repeat(200),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: "Full name is invalid.",
          path: ["fullName"],
        }),
      );
    }
  });

  it("accepts display and comparison names within the database limit", () => {
    const fullName = "É".repeat(200);
    const result = studentRegistryEntrySchema.parse({
      ...validEntry,
      fullName,
    });

    expect(result.fullName).toBe(fullName);
    expect(result.normalizedFullName).toBe("é".repeat(200));
    expect(result.fullName).toHaveLength(200);
    expect(result.normalizedFullName).toHaveLength(200);
  });
});
