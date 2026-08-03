import "server-only";

import { createHash } from "node:crypto";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  REGISTRY_IMPORT_MAX_BYTES,
  REGISTRY_IMPORT_MAX_ROWS,
  REGISTRY_IMPORT_OPTIONAL_HEADERS,
  REGISTRY_IMPORT_REQUIRED_HEADERS,
  type RegistryImportErrorCode,
  type RegistryImportNormalizedRow,
  validateRegistryImportRow,
} from "@/features/registry-import/schemas";

const CSV_MIME = "text/csv";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_ARCHIVE_ENTRIES = 256;
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_CELL_INPUT_LENGTH = 1_000;
const unsafeCellPrefix = /^[=+\-@]/u;
const unsafeControlCharacter =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

export type RegistryImportSourceType = "CSV" | "XLSX";

export type ParsedRegistryImportRow = {
  rowNumber: number;
  value: RegistryImportNormalizedRow | null;
  errors: RegistryImportErrorCode[];
};

export type ParsedRegistryImport = {
  checksum: string;
  originalFilename: string;
  originalByteSize: number;
  sourceType: RegistryImportSourceType;
  rows: ParsedRegistryImportRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
};

export type RegistryImportParseErrorCode =
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

export class RegistryImportParseError extends Error {
  constructor(readonly code: RegistryImportParseErrorCode) {
    super("The registry import file could not be accepted.");
    this.name = "RegistryImportParseError";
  }
}

function fail(code: RegistryImportParseErrorCode): never {
  throw new RegistryImportParseError(code);
}

function safeFilename(filename: string): string {
  const basename = path.win32.basename(path.posix.basename(filename));
  const normalized = basename
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/gu, "")
    .trim();
  return (normalized || "registry-import").slice(0, 255);
}

function sourceType(
  filename: string,
  mimeType: string,
): RegistryImportSourceType {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".csv") {
    if (mimeType !== CSV_MIME) fail("MIME_MISMATCH");
    return "CSV";
  }
  if (extension === ".xlsx") {
    if (mimeType !== XLSX_MIME) fail("MIME_MISMATCH");
    return "XLSX";
  }
  fail("UNSUPPORTED_FILE");
}

function readUInt16(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > buffer.length) fail("MALFORMED_XLSX");
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > buffer.length) fail("MALFORMED_XLSX");
  return buffer.readUInt32LE(offset);
}

export function inspectXlsxPackage(buffer: Buffer): void {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
    fail(
      buffer.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))
        ? "ENCRYPTED_WORKBOOK"
        : "MALFORMED_XLSX",
    );
  }

  const minimumOffset = Math.max(0, buffer.length - 65_557);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) fail("MALFORMED_XLSX");

  const diskNumber = readUInt16(buffer, endOffset + 4);
  const centralDisk = readUInt16(buffer, endOffset + 6);
  const entriesOnDisk = readUInt16(buffer, endOffset + 8);
  const entryCount = readUInt16(buffer, endOffset + 10);
  const centralSize = readUInt32(buffer, endOffset + 12);
  const centralOffset = readUInt32(buffer, endOffset + 16);
  const commentLength = readUInt16(buffer, endOffset + 20);
  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0 ||
    entryCount > MAX_ARCHIVE_ENTRIES ||
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    centralOffset + centralSize > endOffset ||
    endOffset + 22 + commentLength !== buffer.length
  ) {
    fail("UNSAFE_ARCHIVE");
  }

  let offset = centralOffset;
  let totalUncompressed = 0;
  const names = new Set<string>();
  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) fail("MALFORMED_XLSX");
    const flags = readUInt16(buffer, offset + 8);
    const method = readUInt16(buffer, offset + 10);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const nameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const entryCommentLength = readUInt16(buffer, offset + 32);
    const nextOffset =
      offset + 46 + nameLength + extraLength + entryCommentLength;
    if (
      (flags & 0x1) !== 0 ||
      (flags & 0x40) !== 0 ||
      (method !== 0 && method !== 8) ||
      nextOffset > centralOffset + centralSize
    ) {
      fail("UNSAFE_ARCHIVE");
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES)
      fail("UNSAFE_ARCHIVE");

    const entryName = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString((flags & 0x800) !== 0 ? "utf8" : "ascii")
      .replaceAll("\\", "/")
      .toLowerCase();
    if (
      !entryName ||
      entryName.startsWith("/") ||
      entryName.includes("../") ||
      entryName.includes("\u0000") ||
      names.has(entryName)
    ) {
      fail("UNSAFE_ARCHIVE");
    }
    names.add(entryName);
    if (
      entryName.includes("vbaproject") ||
      entryName.startsWith("xl/activex/")
    ) {
      fail("MACRO_WORKBOOK");
    }
    if (entryName.startsWith("xl/externallinks/")) fail("EXTERNAL_LINKS");
    offset = nextOffset;
  }
  if (
    offset !== centralOffset + centralSize ||
    !names.has("[content_types].xml") ||
    !names.has("xl/workbook.xml")
  ) {
    fail("MALFORMED_XLSX");
  }
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
    if (rows.length > REGISTRY_IMPORT_MAX_ROWS + 2) fail("TOO_MANY_ROWS");
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (afterQuote) {
      if (character === ",") pushField();
      else if (character === "\n") pushRow();
      else if (character === "\r" && text[index + 1] === "\n") {
        pushRow();
        index += 1;
      } else fail("MALFORMED_CSV");
      continue;
    }
    if (character === '"') {
      if (field.length !== 0) fail("MALFORMED_CSV");
      quoted = true;
    } else if (character === ",") pushField();
    else if (character === "\n") pushRow();
    else if (character === "\r" && text[index + 1] === "\n") {
      pushRow();
      index += 1;
    } else field += character;
  }
  if (quoted) fail("MALFORMED_CSV");
  if (field.length > 0 || row.length > 0 || afterQuote) pushRow();
  return rows;
}

function cellValue(cell: ExcelJS.Cell): string {
  if (cell.type === ExcelJS.ValueType.Formula) fail("FORMULA_CELL");
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "formula" in value) fail("FORMULA_CELL");
  if (
    typeof value === "object" &&
    "richText" in value &&
    Array.isArray(value.richText)
  ) {
    return value.richText.map((part) => part.text).join("");
  }
  fail("MALFORMED_XLSX");
}

async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  inspectXlsxPackage(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
  } catch {
    fail("MALFORMED_XLSX");
  }
  if (workbook.worksheets.length !== 1) fail("MULTIPLE_WORKSHEETS");
  const worksheet = workbook.worksheets[0]!;
  if (worksheet.rowCount > REGISTRY_IMPORT_MAX_ROWS + 1) fail("TOO_MANY_ROWS");
  if (worksheet.columnCount > 6) fail("TOO_MANY_COLUMNS");
  const rows: string[][] = [];
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: string[] = [];
    for (
      let column = 1;
      column <= Math.max(worksheet.columnCount, 1);
      column += 1
    ) {
      values.push(cellValue(row.getCell(column)));
    }
    rows.push(values);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value.normalize("NFC").trim().toLowerCase();
}

function validateHeaders(row: readonly string[]): readonly string[] {
  const headers = row.map(normalizeHeader);
  const nonEmpty = headers.filter(Boolean);
  if (new Set(nonEmpty).size !== nonEmpty.length) fail("DUPLICATE_HEADERS");
  const required = [...REGISTRY_IMPORT_REQUIRED_HEADERS];
  for (const header of required)
    if (!headers.includes(header)) fail("MISSING_HEADERS");
  const allowed = new Set([...required, ...REGISTRY_IMPORT_OPTIONAL_HEADERS]);
  if (headers.some((header) => !allowed.has(header as never)))
    fail("UNKNOWN_HEADERS");
  const expected = headers.includes("status")
    ? [...required, "status"]
    : required;
  if (
    headers.length !== expected.length ||
    headers.some((header, index) => header !== expected[index])
  ) {
    fail("INVALID_HEADER_ORDER");
  }
  return headers;
}

function unsafeCell(value: string): boolean {
  return (
    value.length > MAX_CELL_INPUT_LENGTH ||
    unsafeControlCharacter.test(value) ||
    unsafeCellPrefix.test(value.trimStart())
  );
}

function rowsFromMatrix(matrix: string[][]): ParsedRegistryImportRow[] {
  while (
    matrix.length > 1 &&
    matrix.at(-1)!.every((value) => value.trim() === "")
  ) {
    matrix.pop();
  }
  if (matrix.length === 0) fail("EMPTY_FILE");
  const headers = validateHeaders(matrix[0]!);
  const dataRows = matrix.slice(1);
  if (dataRows.length > REGISTRY_IMPORT_MAX_ROWS) fail("TOO_MANY_ROWS");

  const parsed = dataRows.map((cells, index): ParsedRegistryImportRow => {
    const rowNumber = index + 2;
    if (
      cells.length > headers.length &&
      cells.slice(headers.length).some((value) => value.trim())
    ) {
      return { rowNumber, value: null, errors: ["UNSAFE_CELL"] };
    }
    const values = headers.map((_, column) => cells[column] ?? "");
    if (values.some(unsafeCell))
      return { rowNumber, value: null, errors: ["UNSAFE_CELL"] };
    const result = validateRegistryImportRow({
      studentNumber: values[0]!,
      fullName: values[1]!,
      email: values[2]!,
      program: values[3]!,
      academicYear: values[4]!,
      status: values[5] ?? "",
    });
    return result.ok
      ? { rowNumber, value: result.value, errors: [] }
      : { rowNumber, value: null, errors: result.errors };
  });

  const studentNumbers = new Map<string, number[]>();
  const emails = new Map<string, number[]>();
  for (let index = 0; index < parsed.length; index += 1) {
    const value = parsed[index]!.value;
    if (!value) continue;
    studentNumbers.set(value.studentNumber, [
      ...(studentNumbers.get(value.studentNumber) ?? []),
      index,
    ]);
    emails.set(value.email, [...(emails.get(value.email) ?? []), index]);
  }
  for (const indexes of studentNumbers.values()) {
    if (indexes.length < 2) continue;
    for (const index of indexes)
      parsed[index]!.errors.push("DUPLICATE_STUDENT_NUMBER");
  }
  for (const indexes of emails.values()) {
    if (indexes.length < 2) continue;
    for (const index of indexes) parsed[index]!.errors.push("DUPLICATE_EMAIL");
  }
  for (const row of parsed) {
    if (row.errors.length > 0) row.value = null;
    row.errors = [...new Set(row.errors)].slice(0, 8);
  }
  return parsed;
}

export async function parseRegistryImport(input: {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
}): Promise<ParsedRegistryImport> {
  if (input.bytes.byteLength === 0) fail("EMPTY_FILE");
  if (input.bytes.byteLength > REGISTRY_IMPORT_MAX_BYTES)
    fail("FILE_TOO_LARGE");
  const type = sourceType(input.filename, input.mimeType);
  const buffer = Buffer.from(
    input.bytes.buffer,
    input.bytes.byteOffset,
    input.bytes.byteLength,
  );
  const checksum = createHash("sha256").update(buffer).digest("hex");
  let matrix: string[][];
  if (type === "CSV") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      fail("INVALID_UTF8");
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    matrix = parseCsv(text);
  } else {
    matrix = await parseXlsx(buffer);
  }
  const rows = rowsFromMatrix(matrix);
  const validRows = rows.filter((row) => row.errors.length === 0).length;
  return {
    checksum,
    originalFilename: safeFilename(input.filename),
    originalByteSize: input.bytes.byteLength,
    sourceType: type,
    rows,
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
  };
}
