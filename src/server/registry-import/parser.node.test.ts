// @vitest-environment node

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  parseRegistryImport,
  RegistryImportParseError,
} from "@/server/registry-import/parser.node";

const csvHeader =
  "student_number,full_name,email,program,academic_year,status\r\n";
const validCsvRow =
  "SIST-100,Ada Lovelace,ada@example.test,BAC+3 Software Engineering,YEAR_1,ACTIVE\r\n";

async function xlsxBuffer(rows: readonly (readonly string[])[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Registry");
  for (const row of rows) worksheet.addRow([...row]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function mutateCentralDirectoryEntry(
  bytes: Uint8Array,
  mutation: "encrypted" | "external" | "macro" | "traversal",
): Uint8Array {
  const result = Buffer.from(bytes);
  let endOffset = -1;
  for (let offset = result.length - 22; offset >= 0; offset -= 1) {
    if (result.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  expect(endOffset).toBeGreaterThanOrEqual(0);
  let offset = result.readUInt32LE(endOffset + 16);
  const entryCount = result.readUInt16LE(endOffset + 10);
  for (let index = 0; index < entryCount; index += 1) {
    expect(result.readUInt32LE(offset)).toBe(0x02014b50);
    const nameLength = result.readUInt16LE(offset + 28);
    const extraLength = result.readUInt16LE(offset + 30);
    const commentLength = result.readUInt16LE(offset + 32);
    if (mutation === "encrypted") {
      result.writeUInt16LE(result.readUInt16LE(offset + 8) | 0x1, offset + 8);
      return result;
    }
    if (nameLength >= 20) {
      const prefix =
        mutation === "macro"
          ? "xl/vbaproject.bin"
          : mutation === "external"
            ? "xl/externallinks/"
            : "../";
      const replacement = `${prefix}${"x".repeat(nameLength - prefix.length)}`;
      result.write(replacement, offset + 46, nameLength, "ascii");
      return result;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("A mutable OOXML entry was not found.");
}

function parseCsv(
  body: string,
  overrides: Partial<{ filename: string; mimeType: string }> = {},
) {
  return parseRegistryImport({
    bytes: new TextEncoder().encode(body),
    filename: overrides.filename ?? "registry.csv",
    mimeType: overrides.mimeType ?? "text/csv",
  });
}

describe("registry import parser", () => {
  it("normalizes equivalent valid CSV content and defaults blank status", async () => {
    const parsed = await parseCsv(
      `${csvHeader.replace(",status", "")}sist-100,  Ada   Lovelace ,ADA@EXAMPLE.TEST,bac+3 software engineering,Year 1\r\n`,
    );
    expect(parsed).toMatchObject({
      sourceType: "CSV",
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [
        {
          rowNumber: 2,
          errors: [],
          value: {
            studentNumber: "SIST-100",
            fullName: "Ada Lovelace",
            email: "ada@example.test",
            program: "BAC+3 Software Engineering",
            academicYear: "YEAR_1",
            status: "ACTIVE",
          },
        },
      ],
    });
    expect(parsed.checksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(parsed)).not.toContain("bytes");
  });

  it("parses an equivalent one-sheet XLSX workbook", async () => {
    const bytes = await xlsxBuffer([
      [
        "student_number",
        "full_name",
        "email",
        "program",
        "academic_year",
        "status",
      ],
      [
        "SIST-100",
        "Ada Lovelace",
        "ada@example.test",
        "BAC+3 Software Engineering",
        "YEAR_1",
        "ACTIVE",
      ],
    ]);
    const parsed = await parseRegistryImport({
      bytes,
      filename: "registry.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(parsed.sourceType).toBe("XLSX");
    expect(parsed.rows[0]?.value).toMatchObject({
      studentNumber: "SIST-100",
      email: "ada@example.test",
      status: "ACTIVE",
    });
  });

  it("produces equivalent normalized CSV and XLSX previews", async () => {
    const csv = await parseCsv(
      `${csvHeader}sist-100,  Ada   Lovelace ,ADA@EXAMPLE.TEST,bac+3 software engineering,Year 1,active\r\n`,
    );
    const xlsx = await parseRegistryImport({
      bytes: await xlsxBuffer([
        [
          "student_number",
          "full_name",
          "email",
          "program",
          "academic_year",
          "status",
        ],
        [
          "sist-100",
          "  Ada   Lovelace ",
          "ADA@EXAMPLE.TEST",
          "bac+3 software engineering",
          "Year 1",
          "active",
        ],
      ]),
      filename: "registry.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(xlsx.rows).toEqual(csv.rows);
  });

  it.each([
    [
      "missing header",
      "student_number,full_name,email,program\r\n",
      "MISSING_HEADERS",
    ],
    ["unknown header", `${csvHeader.trimEnd()},unknown\r\n`, "UNKNOWN_HEADERS"],
    [
      "duplicate header",
      `${csvHeader.trimEnd()},email\r\n`,
      "DUPLICATE_HEADERS",
    ],
    ["empty file", "", "EMPTY_FILE"],
    [
      "null byte",
      `${csvHeader}SIST-1,Ada\u0000,ada@example.test,BAC+3 Software Engineering,YEAR_1,ACTIVE`,
      "UNSAFE_CELL",
    ],
    ["malformed quoting", `${csvHeader}\"unterminated`, "MALFORMED_CSV"],
    [
      "formula prefix",
      `${csvHeader}=SIST-1,Ada,ada@example.test,BAC+3 Software Engineering,YEAR_1,ACTIVE`,
      "UNSAFE_CELL",
    ],
  ])("rejects or invalidates %s safely", async (_name, body, code) => {
    try {
      const parsed = await parseCsv(body);
      expect(parsed.rows[0]?.errors).toContain(code);
    } catch (error) {
      expect(error).toBeInstanceOf(RegistryImportParseError);
      expect((error as RegistryImportParseError).code).toBe(code);
    }
  });

  it("rejects duplicate identifiers throughout a batch", async () => {
    const parsed = await parseCsv(
      `${csvHeader}${validCsvRow}SIST-100,Grace Hopper,grace@example.test,BAC+3 Software Engineering,YEAR_1,ACTIVE\r\nSIST-101,Other Name,ada@example.test,BAC+3 Software Engineering,YEAR_1,ACTIVE\r\n`,
    );
    expect(parsed.invalidRows).toBe(3);
    expect(parsed.rows[0]?.errors).toContain("DUPLICATE_STUDENT_NUMBER");
    expect(parsed.rows[0]?.errors).toContain("DUPLICATE_EMAIL");
  });

  it("uses deterministic bounded field validation codes", async () => {
    const parsed = await parseCsv(
      `${csvHeader}bad space,,not-an-email,Unknown Program,Year 9,deleted\r\n`,
    );
    expect(parsed.rows[0]).toEqual({
      rowNumber: 2,
      value: null,
      errors: [
        "INVALID_PROGRAM",
        "INVALID_ACADEMIC_YEAR",
        "INVALID_STATUS",
        "INVALID_STUDENT_NUMBER",
        "INVALID_FULL_NAME",
        "INVALID_EMAIL",
      ],
    });
    expect(parsed.rows[0]?.errors.length).toBeLessThanOrEqual(8);
  });

  it("requires the fixed header order and sanitizes path-like filenames", async () => {
    await expect(
      parseCsv(
        "email,student_number,full_name,program,academic_year\r\nada@example.test,SIST-100,Ada Lovelace,BAC+3 Software Engineering,YEAR_1\r\n",
      ),
    ).rejects.toMatchObject({ code: "INVALID_HEADER_ORDER" });
    const parsed = await parseCsv(csvHeader + validCsvRow, {
      filename: "../../unsafe/registry.csv",
    });
    expect(parsed.originalFilename).toBe("registry.csv");
  });

  it("rejects invalid UTF-8 and MIME mismatches", async () => {
    await expect(
      parseRegistryImport({
        bytes: Uint8Array.from([0xff, 0xfe]),
        filename: "registry.csv",
        mimeType: "text/csv",
      }),
    ).rejects.toMatchObject({ code: "INVALID_UTF8" });
    await expect(
      parseCsv(csvHeader + validCsvRow, {
        mimeType: "application/octet-stream",
      }),
    ).rejects.toMatchObject({ code: "MIME_MISMATCH" });
  });

  it("rejects multiple worksheets and formula cells", async () => {
    const multiple = new ExcelJS.Workbook();
    multiple.addWorksheet("One").addRow(["student_number"]);
    multiple.addWorksheet("Two").addRow(["student_number"]);
    await expect(
      parseRegistryImport({
        bytes: new Uint8Array(await multiple.xlsx.writeBuffer()),
        filename: "registry.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ).rejects.toMatchObject({ code: "MULTIPLE_WORKSHEETS" });

    const formula = new ExcelJS.Workbook();
    const sheet = formula.addWorksheet("Registry");
    sheet.addRow([
      "student_number",
      "full_name",
      "email",
      "program",
      "academic_year",
    ]);
    sheet.getCell("A2").value = { formula: '"SIST-100"', result: "SIST-100" };
    await expect(
      parseRegistryImport({
        bytes: new Uint8Array(await formula.xlsx.writeBuffer()),
        filename: "registry.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ).rejects.toMatchObject({ code: "FORMULA_CELL" });
  });

  it.each([
    ["encrypted ZIP flags", "encrypted", "UNSAFE_ARCHIVE"],
    ["macro package entries", "macro", "MACRO_WORKBOOK"],
    ["external-link package entries", "external", "EXTERNAL_LINKS"],
    ["path-traversal package entries", "traversal", "UNSAFE_ARCHIVE"],
  ] as const)(
    "rejects %s before workbook parsing",
    async (_name, mutation, code) => {
      const bytes = await xlsxBuffer([
        ["student_number", "full_name", "email", "program", "academic_year"],
        [
          "SIST-100",
          "Ada Lovelace",
          "ada@example.test",
          "BAC+3 Software Engineering",
          "YEAR_1",
        ],
      ]);
      await expect(
        parseRegistryImport({
          bytes: mutateCentralDirectoryEntry(bytes, mutation),
          filename: "registry.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      ).rejects.toMatchObject({ code });
    },
  );

  it("rejects legacy encrypted and malformed workbook containers", async () => {
    await expect(
      parseRegistryImport({
        bytes: Uint8Array.from(
          Buffer.from("d0cf11e0a1b11ae10000000000000000000000000000", "hex"),
        ),
        filename: "registry.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ).rejects.toMatchObject({ code: "ENCRYPTED_WORKBOOK" });
    await expect(
      parseRegistryImport({
        bytes: Uint8Array.from(
          Buffer.from("504b0304000000000000000000000000", "hex"),
        ),
        filename: "registry.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ).rejects.toMatchObject({ code: "MALFORMED_XLSX" });
  });

  it("rejects oversized files and row counts", async () => {
    await expect(
      parseRegistryImport({
        bytes: new Uint8Array(5 * 1024 * 1024 + 1),
        filename: "registry.csv",
        mimeType: "text/csv",
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    const manyRows = `${csvHeader}${validCsvRow.repeat(5_001)}`;
    await expect(parseCsv(manyRows)).rejects.toMatchObject({
      code: "TOO_MANY_ROWS",
    });
  });
});
