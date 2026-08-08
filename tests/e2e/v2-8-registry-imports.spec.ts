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
  uploader: "a8300000-0000-4000-8000-000000000001",
  reviewer: "a8300000-0000-4000-8000-000000000002",
  dual: "a8300000-0000-4000-8000-000000000003",
  zero: "a8300000-0000-4000-8000-000000000004",
} as const;
const fixtureUserIds = Object.values(ids);
const viewports = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;
const csvHeader =
  "student_number,full_name,email,program,academic_year,status\r\n";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function withDatabase<T>(
  operation: (database: PrismaClient) => Promise<T>,
) {
  if (!process.env.DATABASE_URL)
    throw new Error("V2-8 browser database is unavailable.");
  const database = createPrismaClient(process.env.DATABASE_URL);
  try {
    return await operation(database);
  } finally {
    await database.$disconnect();
  }
}

async function cleanup(database: PrismaClient) {
  await database.importBatch.deleteMany({
    where: { uploaderId: { in: fixtureUserIds } },
  });
  await database.studentRegistry.deleteMany({
    where: { studentNumber: { startsWith: "V28-BROWSER-" } },
  });
  await database.userCapabilityAssignment.deleteMany({
    where: { userId: { in: fixtureUserIds } },
  });
}

async function setSession(page: Page, actorId: string) {
  const token = await encode({
    maxAge: 8 * 60 * 60,
    salt: "authjs.session-token",
    secret: browserOnlyAuthSecret,
    token: {
      sub: actorId,
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 0,
    },
  });
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

function csvRow(input: {
  studentNumber: string;
  fullName?: string;
  email?: string;
  status?: string;
}) {
  return [
    input.studentNumber,
    input.fullName ?? "V2 Eight Browser Student",
    input.email ?? `${input.studentNumber.toLowerCase()}@example.test`,
    "BAC+3 Software Engineering",
    "YEAR_1",
    input.status ?? "ACTIVE",
  ].join(",");
}

async function uploadCsv(page: Page, filename: string, row: string) {
  await page.getByLabel("CSV or XLSX file").setInputFiles({
    name: filename,
    mimeType: "text/csv",
    buffer: Buffer.from(`${csvHeader}${row}\r\n`, "utf8"),
  });
  const detailNavigation = page.waitForURL(
    /\/staff\/imports\/registry\/[0-9a-f-]+/u,
  );
  await page.getByRole("button", { name: "Upload and validate" }).click();
  await detailNavigation;
  await expect(page.getByRole("heading", { name: filename })).toBeVisible({
    timeout: 60_000,
  });
  return page.url().split("?")[0]!;
}

async function expectNoOverflow(page: Page) {
  const defects = await page.evaluate(() => {
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
  expect(defects).toEqual([]);
}

async function expectAccessibleControls(page: Page) {
  const defects = await page.evaluate(() => ({
    unnamedControls: Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input:not([type=hidden]), textarea",
      ),
    ).filter(
      (control) =>
        control.labels?.length === 0 &&
        !control.getAttribute("aria-label") &&
        !control.getAttribute("aria-labelledby"),
    ).length,
    unnamedInteractive: Array.from(
      document.querySelectorAll<HTMLElement>("button, a[href]"),
    ).filter(
      (element) =>
        !element.textContent?.trim() &&
        !element.getAttribute("aria-label") &&
        !element.getAttribute("aria-labelledby"),
    ).length,
  }));
  expect(defects).toEqual({ unnamedControls: 0, unnamedInteractive: 0 });
}

test.beforeAll(async () => {
  await withDatabase(async (database) => {
    await cleanup(database);
    for (const [id, label] of [
      [ids.uploader, "Uploader"],
      [ids.reviewer, "Reviewer"],
      [ids.dual, "Dual Control"],
      [ids.zero, "Zero Capability"],
    ] as const) {
      await database.user.upsert({
        where: { id },
        create: {
          id,
          email: `v28-browser-${label.toLowerCase().replaceAll(" ", "-")}@example.test`,
          fullName: `V2-8 Browser ${label}`,
          passwordHash: "suite-owned-non-authenticating-value",
          role: "STAFF",
          status: "ACTIVE",
          sessionVersion: 0,
        },
        update: {
          fullName: `V2-8 Browser ${label}`,
          role: "STAFF",
          status: "ACTIVE",
          sessionVersion: 0,
          disabledAt: null,
          disabledById: null,
        },
      });
    }
    await database.userCapabilityAssignment.createMany({
      data: [
        { userId: ids.uploader, capability: "REGISTRY_IMPORT_UPLOAD" },
        { userId: ids.reviewer, capability: "REGISTRY_IMPORT_APPROVE" },
        { userId: ids.dual, capability: "REGISTRY_IMPORT_UPLOAD" },
        { userId: ids.dual, capability: "REGISTRY_IMPORT_APPROVE" },
      ],
    });
  });
});

test.afterAll(async () => {
  await withDatabase(cleanup);
});

test("uploads, validates, submits, and applies a batch through an independent reviewer", async ({
  page,
}) => {
  await setSession(page, ids.uploader);
  await page.goto("/staff/imports/registry");
  await expect(
    page.getByRole("heading", { name: "Student Registry imports" }),
  ).toBeVisible();

  const invalidUrl = await uploadCsv(
    page,
    "invalid.csv",
    csvRow({
      studentNumber: "V28-BROWSER-INVALID",
      email: "not-an-email",
    }),
  );
  await expect(page.getByText("UPLOADED", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("INVALID_EMAIL", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("button", { name: "Submit for approval" }),
  ).toHaveCount(0);
  expect(invalidUrl).toMatch(/\/staff\/imports\/registry\//u);

  await page.goto("/staff/imports/registry");
  const batchUrl = await uploadCsv(
    page,
    "valid.csv",
    csvRow({ studentNumber: "V28-BROWSER-APPROVE" }),
  );
  await expect(page.getByText("VALIDATED", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page).toHaveURL(/result=PENDING_APPROVAL/u, { timeout: 60_000 });
  await expect(page.getByText("PENDING APPROVAL", { exact: true })).toBeVisible(
    {
      timeout: 60_000,
    },
  );

  await setSession(page, ids.reviewer);
  await page.goto(`${batchUrl}?review=independent`);
  await expect(
    page.getByRole("heading", { name: "Independent review" }),
  ).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Approve complete batch" }).click();
  await expect(page).toHaveURL(/result=APPROVED/u, { timeout: 60_000 });
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText("The complete batch was approved and applied."),
  ).toBeVisible({ timeout: 60_000 });
  await withDatabase(async (database) => {
    await expect(
      database.studentRegistry.findUnique({
        where: { studentNumber: "V28-BROWSER-APPROVE" },
      }),
    ).resolves.toMatchObject({ source: "OFFICIAL_IMPORT" });
  });
});

test("shows four-eyes self-review denial and hides reviewer controls", async ({
  page,
}) => {
  await setSession(page, ids.dual);
  await page.goto("/staff/imports/registry");
  await uploadCsv(
    page,
    "self-review.csv",
    csvRow({ studentNumber: "V28-BROWSER-SELF" }),
  );
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page).toHaveURL(/result=PENDING_APPROVAL/u, { timeout: 60_000 });
  await expect(
    page.getByText(/uploader cannot approve or reject/iu),
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("button", { name: "Approve complete batch" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject batch" })).toHaveCount(
    0,
  );
});

test("supports independent rejection and presents a terminal state", async ({
  page,
}) => {
  await setSession(page, ids.uploader);
  await page.goto("/staff/imports/registry");
  const batchUrl = await uploadCsv(
    page,
    "reject.csv",
    csvRow({ studentNumber: "V28-BROWSER-REJECT" }),
  );
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page).toHaveURL(/result=PENDING_APPROVAL/u, { timeout: 60_000 });

  await setSession(page, ids.reviewer);
  await page.goto(batchUrl);
  await page.getByLabel("Rejection reason").fill("Registry evidence mismatch");
  await page.getByRole("button", { name: "Reject batch" }).click();
  await expect(page).toHaveURL(/result=REJECTED/u, { timeout: 60_000 });
  await expect(page.getByText("REJECTED", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("The batch was rejected.")).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("button", { name: "Approve complete batch" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject batch" })).toHaveCount(
    0,
  );
});

test("denies a zero-capability STAFF account", async ({ page }) => {
  await setSession(page, ids.zero);
  await page.goto("/staff/imports/registry");
  await expect(page).toHaveURL(/\/unauthorized$/u);
});

for (const viewport of viewports) {
  test(`registry routes fit ${viewport.width}x${viewport.height} with accessible controls`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await setSession(page, ids.uploader);
    await page.goto("/staff/imports/registry");
    await expectNoOverflow(page);
    await expectAccessibleControls(page);
  });
}

test("supports light/dark themes, keyboard operation, and visible focus", async ({
  page,
}) => {
  await setSession(page, ids.uploader);
  await page.goto("/staff/imports/registry");
  const toggle = page.getByRole("button", {
    name: "Toggle light and dark theme",
  });
  await expect(toggle).toBeEnabled({ timeout: 60_000 });
  await toggle.focus();
  await expect(toggle).toBeFocused();
  const focusStyle = await toggle.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.outlineStyle}|${style.boxShadow}`;
  });
  expect(focusStyle).not.toBe("none|none");
  const before = await page.locator("html").getAttribute("data-theme");
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.locator("html").getAttribute("data-theme"))
    .not.toBe(before);
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.locator("html").getAttribute("data-theme"))
    .toBe(before);
});
