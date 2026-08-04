import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { encode } from "@auth/core/jwt";

import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  createSessionHistoryMarker,
  SESSION_HISTORY_COOKIE_NAME,
} from "../../src/features/auth/session-marker";
import { createPrismaClient } from "../../src/server/db/factory.node";
import { browserOnlyAuthSecret } from "./v2-5-test-environment";

const staffId = "99700000-0000-4000-8000-000000000001";
const zeroStaffId = "99700000-0000-4000-8000-000000000002";
const disabledStaffId = "99700000-0000-4000-8000-000000000003";
const studentId = "99700000-0000-4000-8000-000000000004";
const profileId = "99700000-0000-4000-8000-000000000005";
const categoryId = "99700000-0000-4000-8000-000000000006";
let requestId = "";

const viewports = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

test.describe.configure({ mode: "serial" });

async function withDatabase<T>(
  operation: (database: PrismaClient) => Promise<T>,
) {
  if (!process.env.DATABASE_URL)
    throw new Error("V2-6 browser database is unavailable.");
  const database = createPrismaClient(process.env.DATABASE_URL);
  try {
    return await operation(database);
  } finally {
    await database.$disconnect();
  }
}

async function setSession(
  page: Page,
  options: {
    id: string;
    role: "STAFF" | "STUDENT";
    sessionVersion?: number;
  },
) {
  const sessionToken = await encode({
    maxAge: 8 * 60 * 60,
    salt: "authjs.session-token",
    secret: browserOnlyAuthSecret,
    token: {
      sub: options.id,
      role: options.role,
      status: "ACTIVE",
      sessionVersion: options.sessionVersion ?? 0,
    },
  });
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: sessionToken,
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

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
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
  expect(overflow).toEqual([]);
}

async function expectAccessibleControls(page: Page) {
  const defects = await page.evaluate(() => ({
    unnamedControls: Array.from(
      document.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input:not([type=hidden]), select, textarea"),
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
    for (const user of [
      {
        id: staffId,
        email: "v2-6-browser-staff@example.test",
        fullName: "V2-6 Browser Staff",
        role: "STAFF" as const,
        status: "ACTIVE" as const,
      },
      {
        id: zeroStaffId,
        email: "v2-6-browser-zero@example.test",
        fullName: "V2-6 Zero Capability Staff",
        role: "STAFF" as const,
        status: "ACTIVE" as const,
      },
      {
        id: disabledStaffId,
        email: "v2-6-browser-disabled@example.test",
        fullName: "V2-6 Disabled Staff",
        role: "STAFF" as const,
        status: "DISABLED" as const,
      },
      {
        id: studentId,
        email: "v2-6-browser-student@example.test",
        fullName: "V2-6 Browser Student",
        role: "STUDENT" as const,
        status: "ACTIVE" as const,
      },
    ]) {
      const disabledTracking =
        user.status === "DISABLED"
          ? {
              disabledAt: new Date("2026-01-01T00:00:00.000Z"),
              disabledById: staffId,
            }
          : { disabledAt: null, disabledById: null };
      await database.user.upsert({
        where: { id: user.id },
        create: {
          ...user,
          passwordHash: "suite-owned-non-authenticating-value",
          sessionVersion: 0,
          ...disabledTracking,
        },
        update: {
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          sessionVersion: 0,
          ...disabledTracking,
        },
      });
    }
    await database.studentProfile.upsert({
      where: { id: profileId },
      create: {
        id: profileId,
        userId: studentId,
        studentNumber: "V26BROWSER",
        program: "Browser Verification Programme",
        academicYear: "MASTER_1",
      },
      update: {
        userId: studentId,
        studentNumber: "V26BROWSER",
        program: "Browser Verification Programme",
        academicYear: "MASTER_1",
      },
    });
    await database.requestCategory.upsert({
      where: { id: categoryId },
      create: {
        id: categoryId,
        name: "V2-6 Browser Certificate",
        slug: "v2-6-browser-certificate",
        description: "Browser fixture",
        isActive: true,
      },
      update: { isActive: true },
    });
    await database.userCapabilityAssignment.createMany({
      data: [
        "PROCESS_REQUESTS",
        "MANAGE_REQUEST_CATEGORIES",
        "EXPORT_STUDENT_DATA",
        "EXPORT_REQUEST_DATA",
      ].map((capability) => ({
        userId: staffId,
        capability: capability as
          | "PROCESS_REQUESTS"
          | "MANAGE_REQUEST_CATEGORIES"
          | "EXPORT_STUDENT_DATA"
          | "EXPORT_REQUEST_DATA",
      })),
      skipDuplicates: true,
    });
  });
});

test.beforeEach(async () => {
  requestId = await withDatabase(async (database) => {
    await database.user.update({
      where: { id: staffId },
      data: { status: "ACTIVE", sessionVersion: 0 },
    });
    await database.user.update({
      where: { id: disabledStaffId },
      data: {
        status: "DISABLED",
        sessionVersion: 0,
        disabledAt: new Date("2026-01-01T00:00:00.000Z"),
        disabledById: staffId,
      },
    });
    await database.requestCategory.update({
      where: { id: categoryId },
      data: { isActive: true },
    });
    const request = await database.documentRequest.create({
      data: {
        id: randomUUID(),
        studentId: profileId,
        categoryId,
        status: "SUBMITTED",
        deliveryMethod: "DIGITAL_DELIVERY",
        copyCount: 2,
        details: "Browser-owned request details",
      },
    });
    await database.requestStatusHistory.create({
      data: {
        requestId: request.id,
        fromStatus: null,
        toStatus: "SUBMITTED",
        changedById: studentId,
      },
    });
    return request.id;
  });
});

test("authorized STAFF filters the queue and opens request details", async ({
  page,
}) => {
  await setSession(page, { id: staffId, role: "STAFF" });
  await page.goto("/staff/requests");
  await expect(
    page.getByRole("heading", { name: "Request queue" }),
  ).toBeVisible();
  await page.getByLabel("Student").fill("V26BROWSER");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("V26BROWSER").first()).toBeVisible();
  await expect(
    page.locator(`a[href='/staff/requests/${requestId}']`),
  ).toBeVisible();
  await page.goto(`/staff/requests/${requestId}`);
  await expect(page.getByText("Browser-owned request details")).toBeVisible();
});

test("valid transition succeeds and tampered skipped transition fails safely", async ({
  page,
}) => {
  await setSession(page, { id: staffId, role: "STAFF" });
  await page.goto(`/staff/requests/${requestId}`);
  await page.getByLabel("Next status").selectOption("UNDER_REVIEW");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("The request status was updated.")).toBeVisible();
  await page.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>(
      'select[name="targetStatus"]',
    );
    select?.append(new Option("Completed", "COMPLETED"));
  });
  await page.getByLabel("Next status").selectOption("COMPLETED");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText(/could not be completed/iu)).toBeVisible();
});

test("rejection requires a reason", async ({ page }) => {
  await setSession(page, { id: staffId, role: "STAFF" });
  await page.goto(`/staff/requests/${requestId}`);
  await page.getByLabel("Next status").selectOption("REJECTED");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText(/could not be completed/iu)).toBeVisible();
});

test("public messages reach the student while internal notes remain private", async ({
  page,
}) => {
  await setSession(page, { id: staffId, role: "STAFF" });
  await page.goto(`/staff/requests/${requestId}`);
  await page.getByLabel("Visibility").selectOption("INTERNAL");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Browser private note");
  await page.getByRole("button", { name: "Add message" }).click();
  await expect
    .poll(() =>
      withDatabase((database) =>
        database.requestMessage.count({
          where: {
            requestId,
            visibility: "INTERNAL",
            body: "Browser private note",
          },
        }),
      ),
    )
    .toBe(1);
  await page.getByLabel("Visibility").selectOption("PUBLIC");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Browser public update");
  const publicMessageResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/staff/requests/${requestId}`),
  );
  await page.getByRole("button", { name: "Add message" }).click();
  await publicMessageResponse;
  await expect
    .poll(() =>
      withDatabase((database) =>
        database.requestMessage.count({
          where: {
            requestId,
            visibility: "PUBLIC",
            body: "Browser public update",
          },
        }),
      ),
    )
    .toBe(1);
  await setSession(page, { id: studentId, role: "STUDENT" });
  await page.goto(`/student/requests/${requestId}`);
  await page.reload();
  await expect(page.getByText("Browser public update")).toBeVisible();
  await expect(page.getByText("Browser private note")).toHaveCount(0);
  await expect(page.getByText(/Message from SIST Staff/iu)).toBeVisible();
});

test("category create, edit, deactivate, and activate remain available", async ({
  page,
}) => {
  await setSession(page, { id: staffId, role: "STAFF" });
  await page.goto("/staff/request-categories");
  const name = `Browser Category ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Name").first().fill(name);
  await page
    .getByLabel("Description")
    .first()
    .fill("Browser category description");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  const createdCard = page
    .getByText(name, { exact: true })
    .locator("xpath=ancestor::div[@data-slot='card']");
  const matchingName = createdCard.locator('input[name="name"]');
  await matchingName.fill(`${name} Updated`);
  await matchingName
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Save changes" })
    .click();
  await expect
    .poll(() =>
      withDatabase((database) =>
        database.requestCategory.count({ where: { name: `${name} Updated` } }),
      ),
    )
    .toBe(1);
  await page.reload();
  await expect(
    page.getByText(`${name} Updated`, { exact: true }),
  ).toBeVisible();
  const updatedCard = page
    .getByText(`${name} Updated`, { exact: true })
    .locator("xpath=ancestor::div[@data-slot='card']");
  await updatedCard.getByRole("button", { name: "Deactivate" }).click();
  await expect
    .poll(() =>
      withDatabase((database) =>
        database.requestCategory
          .findFirstOrThrow({ where: { name: `${name} Updated` } })
          .then((category) => category.isActive),
      ),
    )
    .toBe(false);
  await page.reload();
  await expect(
    updatedCard.getByRole("button", { name: "Activate" }),
  ).toBeVisible();
  await updatedCard.getByRole("button", { name: "Activate" }).click();
  await expect
    .poll(() =>
      withDatabase((database) =>
        database.requestCategory
          .findFirstOrThrow({ where: { name: `${name} Updated` } })
          .then((category) => category.isActive),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(
    updatedCard.getByRole("button", { name: "Deactivate" }),
  ).toBeVisible();
});

test("CSV downloads require their exact capabilities", async ({ page }) => {
  await setSession(page, { id: staffId, role: "STAFF" });
  await page.goto("/staff/requests");
  const requestDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  await expect((await requestDownload).suggestedFilename()).toBe(
    "sist-requests.csv",
  );
  await page.goto("/staff/student-accounts");
  const studentDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  await expect((await studentDownload).suggestedFilename()).toBe(
    "sist-students.csv",
  );
  await setSession(page, { id: zeroStaffId, role: "STAFF" });
  expect((await page.request.get("/staff/requests/export")).status()).toBe(403);
  expect(
    (await page.request.get("/staff/student-accounts/export")).status(),
  ).toBe(403);
});

test("zero-capability, disabled, and stale STAFF are denied", async ({
  page,
}) => {
  await setSession(page, { id: zeroStaffId, role: "STAFF" });
  await page.goto("/staff/requests");
  await expect(page).toHaveURL(/\/unauthorized$/u);
  await setSession(page, { id: disabledStaffId, role: "STAFF" });
  await page.goto("/staff/request-categories");
  await expect(page).toHaveURL(/\/login\?reason=disabled$/u);
  await setSession(page, { id: staffId, role: "STAFF", sessionVersion: 99 });
  await page.goto("/staff/requests");
  await expect(page).toHaveURL(/\/login\?reason=session-ended$/u);
});

for (const viewport of viewports) {
  test(`V2-6 routes fit ${viewport.width}x${viewport.height} with accessible controls`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await setSession(page, { id: staffId, role: "STAFF" });
    for (const path of [
      "/staff",
      "/staff/requests",
      `/staff/requests/${requestId}`,
      "/staff/request-categories",
    ]) {
      await page.goto(path);
      await expectNoOverflow(page);
      await expectAccessibleControls(page);
    }
  });
}

test("V2-6 routes preserve light and dark theme behavior", async ({ page }) => {
  await setSession(page, { id: staffId, role: "STAFF" });
  await page.goto("/staff/requests");
  const themeButton = page.getByRole("button", { name: /theme/iu });
  await expect(themeButton).toBeEnabled();
  const before = await page.locator("html").getAttribute("data-theme");
  await themeButton.click();
  await expect
    .poll(() => page.locator("html").getAttribute("data-theme"))
    .not.toBe(before);
});
