import { expect, test, type Page } from "@playwright/test";
import { encode } from "@auth/core/jwt";

import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  createSessionHistoryMarker,
  SESSION_HISTORY_COOKIE_NAME,
} from "../../src/features/auth/session-marker";
import { createPrismaClient } from "../../src/server/db/factory.node";
import { browserOnlyAuthSecret } from "./v2-5-test-environment";

const ids = {
  student: "b2100000-0000-4000-8000-000000000001",
  otherStudent: "b2100000-0000-4000-8000-000000000002",
  financeReader: "b2100000-0000-4000-8000-000000000003",
  noFinance: "b2100000-0000-4000-8000-000000000004",
  financeImporter: "b2100000-0000-4000-8000-000000000005",
  financeExporter: "b2100000-0000-4000-8000-000000000006",
  studentProfile: "b2110000-0000-4000-8000-000000000001",
  otherStudentProfile: "b2110000-0000-4000-8000-000000000002",
  studentAccount: "b2120000-0000-4000-8000-000000000001",
  otherStudentAccount: "b2120000-0000-4000-8000-000000000002",
  transaction: "b2130000-0000-4000-8000-000000000001",
  otherTransaction: "b2130000-0000-4000-8000-000000000002",
  batch: "b2140000-0000-4000-8000-000000000001",
  row: "b2150000-0000-4000-8000-000000000001",
} as const;

const fixtureUserIds = [
  ids.student,
  ids.otherStudent,
  ids.financeReader,
  ids.noFinance,
  ids.financeImporter,
  ids.financeExporter,
];
const privateMetadata = "V210-PRIVATE-FINANCE-METADATA";
const viewports = [
  { width: 360, height: 800 },
  { width: 1440, height: 900 },
] as const;

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function withTestDatabase<T>(
  operation: (database: PrismaClient) => Promise<T>,
): Promise<T> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("V2-10 isolated browser database is unavailable.");
  const database = createPrismaClient(url);
  try {
    return await operation(database);
  } finally {
    await database.$disconnect();
  }
}

async function cleanup(database: PrismaClient) {
  await database.financeTransaction.deleteMany({
    where: { id: { in: [ids.transaction, ids.otherTransaction] } },
  });
  await database.financeImportBatch.deleteMany({ where: { id: ids.batch } });
  await database.studentFinanceAccount.deleteMany({
    where: { id: { in: [ids.studentAccount, ids.otherStudentAccount] } },
  });
  await database.studentProfile.deleteMany({
    where: { id: { in: [ids.studentProfile, ids.otherStudentProfile] } },
  });
  await database.userCapabilityAssignment.deleteMany({
    where: { userId: { in: fixtureUserIds } },
  });
}

async function setSession(
  page: Page,
  actorId: string,
  role: "STUDENT" | "STAFF",
) {
  const token = await encode({
    maxAge: 8 * 60 * 60,
    salt: "authjs.session-token",
    secret: browserOnlyAuthSecret,
    token: { sub: actorId, role, status: "ACTIVE", sessionVersion: 0 },
  });
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: SESSION_HISTORY_COOKIE_NAME,
      value: await createSessionHistoryMarker(browserOnlyAuthSecret),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function expectNoBlockingOverflow(page: Page) {
  const evaluate = () => page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.left >= -1 && bounds.right <= Math.ceil(viewportWidth) + 1)
          return false;
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== document.body) {
          if (
            ["auto", "hidden", "scroll"].includes(
              getComputedStyle(ancestor).overflowX,
            )
          )
            return false;
          ancestor = ancestor.parentElement;
        }
        return true;
      })
      .map((element) => element.tagName)
      .slice(0, 10);
  });
  let defects: string[];
  try {
    defects = await evaluate();
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("Execution context was destroyed")
    ) {
      throw error;
    }
    await page.waitForLoadState("domcontentloaded");
    defects = await evaluate();
  }
  expect(defects).toEqual([]);
}

async function expectAccessiblePrimaryControls(page: Page) {
  const evaluate = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("button, a[href]"))
        .filter(
          (element) =>
            !element.textContent?.trim() &&
            !element.getAttribute("aria-label") &&
            !element.getAttribute("aria-labelledby"),
        )
        .map((element) => element.tagName),
    );
  let unnamed: string[];
  try {
    unnamed = await evaluate();
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("Execution context was destroyed")
    ) {
      throw error;
    }
    await page.waitForLoadState("domcontentloaded");
    unnamed = await evaluate();
  }
  expect(unnamed).toEqual([]);
}

async function expectSafeFailure(page: Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(
    /(?:prisma|postgres|database|stack trace|session-token|authjs|secret|V210-PRIVATE-FINANCE-METADATA)/iu,
  );
}

test.beforeAll(async () => {
  await withTestDatabase(async (database) => {
    await cleanup(database);
    for (const [id, role, label] of [
      [ids.student, "STUDENT", "Student"],
      [ids.otherStudent, "STUDENT", "Other Student"],
      [ids.financeReader, "STAFF", "Finance Reader"],
      [ids.noFinance, "STAFF", "No Finance"],
      [ids.financeImporter, "STAFF", "Finance Importer"],
      [ids.financeExporter, "STAFF", "Finance Exporter"],
    ] as const) {
      await database.user.upsert({
        where: { id },
        create: {
          id,
          email: `v210-browser-${label.toLowerCase().replaceAll(" ", "-")}@example.test`,
          fullName: `V2-10 Browser ${label}`,
          passwordHash: "suite-owned-non-authenticating-value",
          role,
          status: "ACTIVE",
          sessionVersion: 0,
        },
        update: {
          email: `v210-browser-${label.toLowerCase().replaceAll(" ", "-")}@example.test`,
          fullName: `V2-10 Browser ${label}`,
          passwordHash: "suite-owned-non-authenticating-value",
          role,
          status: "ACTIVE",
          sessionVersion: 0,
          disabledAt: null,
          disabledById: null,
        },
      });
    }
    await database.studentProfile.createMany({
      data: [
        {
          id: ids.studentProfile,
          userId: ids.student,
          studentNumber: "V210-BROWSER-STUDENT",
          program: "Browser Finance Programme",
          academicYear: "MASTER_1",
        },
        {
          id: ids.otherStudentProfile,
          userId: ids.otherStudent,
          studentNumber: "V210-BROWSER-OTHER",
          program: "Browser Finance Programme",
          academicYear: "MASTER_1",
        },
      ],
    });
    await database.userCapabilityAssignment.createMany({
      data: [
        { userId: ids.financeReader, capability: "VIEW_FINANCE" },
        { userId: ids.financeImporter, capability: "FINANCE_IMPORT_UPLOAD" },
        { userId: ids.financeImporter, capability: "FINANCE_IMPORT_APPROVE" },
        { userId: ids.financeExporter, capability: "VIEW_FINANCE" },
        { userId: ids.financeExporter, capability: "EXPORT_FINANCE_DATA" },
      ],
    });
    await database.studentFinanceAccount.createMany({
      data: [
        { id: ids.studentAccount, studentId: ids.studentProfile },
        { id: ids.otherStudentAccount, studentId: ids.otherStudentProfile },
      ],
    });
    await database.financeTransaction.createMany({
      data: [
        {
          id: ids.transaction,
          accountId: ids.studentAccount,
          entryType: "CHARGE",
          amountMinor: BigInt(12500),
          ledgerEffectMinor: BigInt(12500),
          currency: "MAD",
          effectiveDate: new Date("2026-08-01T00:00:00.000Z"),
          billingPeriod: "2026-2027",
          term: "ANNUAL",
          sourceSystem: "SIST_FINANCE_OFFICIAL",
          externalTransactionId: "V210-BROWSER-OWNED-001",
          sourceReference: "V210-OWNED-REFERENCE",
          description: "Suite-owned posted finance transaction",
          createdById: ids.financeImporter,
          appliedById: ids.financeImporter,
        },
        {
          id: ids.otherTransaction,
          accountId: ids.otherStudentAccount,
          entryType: "CHARGE",
          amountMinor: BigInt(77700),
          ledgerEffectMinor: BigInt(77700),
          currency: "MAD",
          effectiveDate: new Date("2026-08-01T00:00:00.000Z"),
          billingPeriod: "2026-2027",
          term: "ANNUAL",
          sourceSystem: "SIST_FINANCE_OFFICIAL",
          externalTransactionId: "V210-BROWSER-OTHER-001",
          sourceReference: "V210-OTHER-REFERENCE",
          description: privateMetadata,
          createdById: ids.financeImporter,
          appliedById: ids.financeImporter,
        },
      ],
    });
    await database.financeImportBatch.create({
      data: {
        id: ids.batch,
        status: "PENDING_APPROVAL",
        uploaderId: ids.financeImporter,
        checksum:
          "b210000000000000000000000000000000000000000000000000000000000000",
        originalFilename: "v210-suite-owned-finance.csv",
        originalByteSize: 128,
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        validatedAt: new Date("2026-08-01T10:00:00.000Z"),
        submittedAt: new Date("2026-08-01T10:01:00.000Z"),
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        rows: {
          create: {
            id: ids.row,
            rowNumber: 2,
            studentNumber: "V210-BROWSER-STUDENT",
            studentId: ids.studentProfile,
            entryType: "CHARGE",
            amountMinor: BigInt(12500),
            currency: "MAD",
            effectiveDate: new Date("2026-08-01T00:00:00.000Z"),
            postingDate: new Date("2026-08-01T00:00:00.000Z"),
            billingPeriod: "2026-2027",
            term: "ANNUAL",
            sourceSystem: "SIST_FINANCE_OFFICIAL",
            externalTransactionId: "V210-BROWSER-STAGED-001",
            sourceReference: "V210-STAGED-REFERENCE",
            description: "Suite-owned staged row",
            validation: "VALID",
          },
        },
      },
    });
  });
});

test.afterAll(async () => {
  await withTestDatabase(cleanup);
});

test("student finance is owned, authoritative, and denied from staff finance", async ({
  page,
}) => {
  await setSession(page, ids.student, "STUDENT");
  await page.goto(`/student/finance?studentId=${ids.otherStudentProfile}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "My finance statement" }),
  ).toBeVisible();
  await expect(page.getByText("V210-OWNED-REFERENCE")).toBeVisible();
  await expect(page.getByText("V210-OTHER-REFERENCE")).toHaveCount(0);
  await expect(page.getByText(privateMetadata)).toHaveCount(0);

  await page.goto("/staff/finance");
  await expect(page).toHaveURL(/\/unauthorized$/u);
  await expectSafeFailure(page);
});

test("staff without VIEW_FINANCE is denied from Finance reads", async ({
  page,
}) => {
  await setSession(page, ids.noFinance, "STAFF");
  await page.goto("/staff/finance");
  await expect(page).toHaveURL(/\/unauthorized$/u);
  await expectSafeFailure(page);
});

test("authorized staff opens the linked suite-owned Finance record", async ({
  page,
}) => {
  await setSession(page, ids.financeReader, "STAFF");
  await page.goto("/staff/finance");
  await expect(
    page.getByRole("heading", { level: 1, name: "Student Finance" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Export finance CSV" }),
  ).toHaveCount(0);
  const detailPath = `/staff/finance/students/${ids.studentProfile}`;
  const detailResponse = await page.request.get(detailPath, {
    maxRedirects: 0,
  });
  expect(detailResponse.status()).toBe(200);
  await page.locator(`a[href="${detailPath}"]`).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Finance record" }),
  ).toBeVisible();
  await expect(page.getByText("V210-OWNED-REFERENCE")).toBeVisible();
});

test("Finance import staff sees self-review controls withheld", async ({
  page,
}) => {
  await setSession(page, ids.financeImporter, "STAFF");
  await page.goto("/staff/finance/imports");
  await expect(
    page.getByRole("heading", { level: 1, name: "Finance imports" }),
  ).toBeVisible();
  const batchPath = `/staff/finance/imports/${ids.batch}`;
  const batchResponse = await page.request.get(batchPath, { maxRedirects: 0 });
  expect(batchResponse.status()).toBe(200);
  await page.goto(batchPath);
  await expect(
    page.getByText(
      "Four-eyes control: uploaders cannot review their own batches.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve complete batch" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject batch" })).toHaveCount(
    0,
  );
});

test("Finance export controls require EXPORT_FINANCE_DATA", async ({
  page,
}) => {
  await setSession(page, ids.financeExporter, "STAFF");
  await page.goto("/staff/finance");
  await expect(
    page.getByRole("link", { name: "Export finance CSV" }),
  ).toBeVisible();
});

for (const viewport of viewports) {
  test(`finance pages render accessibly at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await setSession(page, ids.student, "STUDENT");
    await page.goto("/student/finance");
    await expect(
      page.getByRole("heading", { level: 1, name: "My finance statement" }),
    ).toBeVisible();
    await expectNoBlockingOverflow(page);
    await expectAccessiblePrimaryControls(page);

    await setSession(page, ids.financeReader, "STAFF");
    await page.goto("/staff/finance");
    await expect(
      page.getByRole("heading", { level: 1, name: "Student Finance" }),
    ).toBeVisible();
    await expectNoBlockingOverflow(page);
    await expectAccessiblePrimaryControls(page);

    await setSession(page, ids.financeImporter, "STAFF");
    const batchPath = `/staff/finance/imports/${ids.batch}`;
    const batchResponse = await page.request.get(batchPath, {
      maxRedirects: 0,
    });
    expect(batchResponse.status()).toBe(200);
    await page.goto(batchPath);
    await expect(
      page.getByRole("heading", { level: 1, name: "Finance import batch" }),
    ).toBeVisible();
    await expectNoBlockingOverflow(page);
    await expectAccessiblePrimaryControls(page);
  });
}

test("finance theme controls and primary focus remain usable", async ({
  page,
}) => {
  await setSession(page, ids.financeReader, "STAFF");
  await page.goto("/staff/finance");
  const search = page.getByRole("searchbox", { name: "Student number" });
  await search.focus();
  await expect(search).toBeFocused();
  const focusStyle = await search.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.outlineStyle}|${style.boxShadow}`;
  });
  expect(focusStyle).not.toBe("none|none");

  const toggle = page.getByRole("button", {
    name: "Toggle light and dark theme",
  });
  await expect(toggle).toBeEnabled({ timeout: 60_000 });
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", { name: "Student Finance" }),
  ).toBeVisible();
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
