import "server-only";

import { createHash } from "node:crypto";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  FINANCE_IMPORT_MAX_BYTES,
  FINANCE_IMPORT_MAX_ROWS,
  FINANCE_OPTIONAL_HEADERS,
  FINANCE_REQUIRED_HEADERS,
  type FinanceImportErrorCode,
  type FinanceImportNormalizedRow,
  validateFinanceImportRow,
} from "@/features/finance/schemas";
import { inspectXlsxPackage } from "@/server/registry-import/parser.node";

const CSV_MIME = "text/csv";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const unsafeCellPrefix = /^[=+\-@]/u;
const unsafeControl = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

export type FinanceImportParseErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "MIME_MISMATCH"
  | "INVALID_UTF8"
  | "MALFORMED_CSV"
  | "MALFORMED_XLSX"
  | "UNSAFE_ARCHIVE"
  | "ENCRYPTED_WORKBOOK"
  | "MACRO_WORKBOOK"
  | "EXTERNAL_LINKS"
  | "MULTIPLE_WORKSHEETS"
  | "MISSING_HEADERS"
  | "UNKNOWN_HEADERS"
  | "DUPLICATE_HEADERS"
  | "INVALID_HEADER_ORDER"
  | "TOO_MANY_ROWS"
  | "TOO_MANY_COLUMNS"
  | "FORMULA_CELL";
export class FinanceImportParseError extends Error {
  constructor(readonly code: FinanceImportParseErrorCode) {
    super("The finance import file could not be accepted.");
  }
}
function fail(code: FinanceImportParseErrorCode): never {
  throw new FinanceImportParseError(code);
}
function filename(value: string) {
  return (
    path.win32
      .basename(path.posix.basename(value))
      .normalize("NFC")
      .replace(/[\u0000-\u001F\u007F]/gu, "")
      .trim() || "finance-import"
  ).slice(0, 255);
}
function sourceType(value: string, mimeType: string): "CSV" | "XLSX" {
  const extension = path.extname(value).toLowerCase();
  if (extension === ".csv" && mimeType === CSV_MIME) return "CSV";
  if (extension === ".xlsx" && mimeType === XLSX_MIME) return "XLSX";
  if (extension === ".csv" || extension === ".xlsx") fail("MIME_MISMATCH");
  fail("UNSUPPORTED_FILE");
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  const pushField = () => {
    row.push(field);
    field = "";
    afterQuote = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
    if (rows.length > FINANCE_IMPORT_MAX_ROWS + 2) fail("TOO_MANY_ROWS");
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else field += char;
      continue;
    }
    if (afterQuote) {
      if (char === ",") pushField();
      else if (char === "\n") pushRow();
      else if (char === "\r" && text[index + 1] === "\n") {
        pushRow();
        index += 1;
      } else fail("MALFORMED_CSV");
      continue;
    }
    if (char === '"') {
      if (field) fail("MALFORMED_CSV");
      quoted = true;
    } else if (char === ",") pushField();
    else if (char === "\n") pushRow();
    else if (char === "\r" && text[index + 1] === "\n") {
      pushRow();
      index += 1;
    } else field += char;
  }
  if (quoted) fail("MALFORMED_CSV");
  if (field || row.length || afterQuote) pushRow();
  return rows;
}
function cellValue(cell: ExcelJS.Cell): string {
  if (
    cell.type === ExcelJS.ValueType.Formula ||
    (typeof cell.value === "object" && cell.value && "formula" in cell.value)
  )
    fail("FORMULA_CELL");
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    typeof value === "object" &&
    "richText" in value &&
    Array.isArray(value.richText)
  )
    return value.richText.map((part) => part.text).join("");
  fail("MALFORMED_XLSX");
}
async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  try {
    inspectXlsxPackage(buffer);
  } catch (error) {
    if (error instanceof Error && "code" in error) throw error;
    fail("MALFORMED_XLSX");
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
  } catch {
    fail("MALFORMED_XLSX");
  }
  if (workbook.worksheets.length !== 1) fail("MULTIPLE_WORKSHEETS");
  const sheet = workbook.worksheets[0]!;
  if (sheet.rowCount > FINANCE_IMPORT_MAX_ROWS + 1) fail("TOO_MANY_ROWS");
  if (sheet.columnCount > 12) fail("TOO_MANY_COLUMNS");
  return Array.from({ length: sheet.rowCount }, (_, rowIndex) =>
    Array.from({ length: Math.max(1, sheet.columnCount) }, (_, columnIndex) =>
      cellValue(sheet.getRow(rowIndex + 1).getCell(columnIndex + 1)),
    ),
  );
}
function headers(row: readonly string[]) {
  const values = row.map((value) =>
    value.normalize("NFC").trim().toLowerCase(),
  );
  const nonEmpty = values.filter(Boolean);
  if (new Set(nonEmpty).size !== nonEmpty.length) fail("DUPLICATE_HEADERS");
  const allowed = [...FINANCE_REQUIRED_HEADERS, ...FINANCE_OPTIONAL_HEADERS];
  if (FINANCE_REQUIRED_HEADERS.some((header) => !values.includes(header)))
    fail("MISSING_HEADERS");
  if (values.some((header) => !allowed.includes(header as never)))
    fail("UNKNOWN_HEADERS");
  const expected = [
    ...FINANCE_REQUIRED_HEADERS,
    ...(values.includes("term") ? ["term"] : []),
    ...(values.includes("description") ? ["description"] : []),
  ];
  if (
    values.length !== expected.length ||
    values.some((header, index) => header !== expected[index])
  )
    fail("INVALID_HEADER_ORDER");
  return values;
}
export type ParsedFinanceImport = {
  checksum: string;
  originalFilename: string;
  originalByteSize: number;
  sourceType: "CSV" | "XLSX";
  rows: Array<{
    rowNumber: number;
    value: FinanceImportNormalizedRow | null;
    errors: FinanceImportErrorCode[];
  }>;
  totalRows: number;
  validRows: number;
  invalidRows: number;
};
export async function parseFinanceImport(input: {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
}): Promise<ParsedFinanceImport> {
  if (!input.bytes.byteLength) fail("EMPTY_FILE");
  if (input.bytes.byteLength > FINANCE_IMPORT_MAX_BYTES) fail("FILE_TOO_LARGE");
  const type = sourceType(input.filename, input.mimeType);
  const buffer = Buffer.from(
    input.bytes.buffer,
    input.bytes.byteOffset,
    input.bytes.byteLength,
  );
  let matrix: string[][];
  if (type === "CSV") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      fail("INVALID_UTF8");
    }
    if (text.includes("\u0000")) fail("INVALID_UTF8");
    matrix = parseCsv(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } else matrix = await parseXlsx(buffer);
  while (matrix.length > 1 && matrix.at(-1)!.every((value) => !value.trim()))
    matrix.pop();
  if (!matrix.length || matrix.length === 1) fail("EMPTY_FILE");
  const orderedHeaders = headers(matrix[0]!);
  const rows = matrix.slice(1).map((cells, index) => {
    const rowNumber = index + 2;
    const values = orderedHeaders.map((_, column) => cells[column] ?? "");
    if (
      values.some(
        (value) =>
          value.length > 1000 ||
          unsafeControl.test(value) ||
          unsafeCellPrefix.test(value.trimStart()),
      )
    )
      return {
        rowNumber,
        value: null,
        errors: ["UNSAFE_CELL"] as FinanceImportErrorCode[],
      };
    const inputRow = Object.fromEntries(
      orderedHeaders.map((header, column) => [header, values[column]!]),
    ) as Record<string, string>;
    const result = validateFinanceImportRow(inputRow);
    return result.ok
      ? {
          rowNumber,
          value: result.value,
          errors: [] as FinanceImportErrorCode[],
        }
      : { rowNumber, value: null, errors: result.errors };
  });
  const identities = new Map<string, number[]>();
  for (const [index, row] of rows.entries())
    if (row.value)
      identities.set(row.value.externalTransactionId, [
        ...(identities.get(row.value.externalTransactionId) ?? []),
        index,
      ]);
  for (const indexes of identities.values())
    if (indexes.length > 1)
      for (const index of indexes)
        rows[index]!.errors.push("DUPLICATE_EXTERNAL_TRANSACTION_ID");
  for (const row of rows) if (row.errors.length) row.value = null;
  const validRows = rows.filter((row) => !row.errors.length).length;
  return {
    checksum: createHash("sha256").update(buffer).digest("hex"),
    originalFilename: filename(input.filename),
    originalByteSize: input.bytes.byteLength,
    sourceType: type,
    rows,
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
  };
}
