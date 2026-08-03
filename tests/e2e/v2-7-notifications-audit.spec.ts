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

const staffId = "a7900000-0000-4000-8000-000000000001";
const zeroStaffId = "a7900000-0000-4000-8000-000000000002";
const studentAId = "a7900000-0000-4000-8000-000000000003";
const studentBId = "a7900000-0000-4000-8000-000000000004";
const profileAId = "a7900000-0000-4000-8000-000000000005";
const profileBId = "a7900000-0000-4000-8000-000000000006";
const categoryId = "a7900000-0000-4000-8000-000000000007";
const studentNotificationId = "a7900000-0000-4000-8000-000000000008";
const privateStudentNotificationId = "a7900000-0000-4000-8000-000000000009";
const staffNotificationId = "a7900000-0000-4000-8000-000000000010";
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
    throw new Error("V2-7 browser database is unavailable.");
  const database = createPrismaClient(process.env.DATABASE_URL);
  try {
    return await operation(database);
  } finally {
    await database.$disconnect();
  }
}

async function setSession(page: Page, id: string, role: "STAFF" | "STUDENT") {
  const token = await encode({
    maxAge: 8 * 60 * 60,
    salt: "authjs.session-token",
    secret: browserOnlyAuthSecret,
    token: { sub: id, role, status: "ACTIVE", sessionVersion: 0 },
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

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
}

async function expectAccessibleControls(page: Page) {
  const defects = await page.evaluate(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          "button, a[href], input, select",
        ),
      ).filter((element) => {
        if (element instanceof HTMLInputElement && element.type === "hidden")
          return false;
        return (
          !element.textContent?.trim() &&
          !element.getAttribute("aria-label") &&
          !element.getAttribute("aria-labelledby") &&
          !(element instanceof HTMLInputElement && element.labels?.length)
        );
      }).length,
  );
  expect(defects).toBe(0);
}

test.beforeAll(async () => {
  await withDatabase(async (database) => {
    for (const user of [
      [
        staffId,
        "v2-7-browser-staff@example.test",
        "V2-7 Browser Staff",
        "STAFF",
      ],
      [
        zeroStaffId,
        "v2-7-browser-zero@example.test",
        "V2-7 Browser Zero",
        "STAFF",
      ],
      [
        studentAId,
        "v2-7-browser-student-a@example.test",
        "V2-7 Browser Student A",
        "STUDENT",
      ],
      [
        studentBId,
        "v2-7-browser-student-b@example.test",
        "V2-7 Browser Student B",
        "STUDENT",
      ],
    ] as const)
      await database.user.upsert({
        where: { id: user[0] },
        create: {
          id: user[0],
          email: user[1],
          fullName: user[2],
          role: user[3],
          status: "ACTIVE",
          passwordHash: "suite-owned-non-authenticating-value",
          sessionVersion: 0,
        },
        update: {
          email: user[1],
          fullName: user[2],
          role: user[3],
          status: "ACTIVE",
          sessionVersion: 0,
        },
      });
    for (const profile of [
      [profileAId, studentAId, "V27BROWSERA"],
      [profileBId, studentBId, "V27BROWSERB"],
    ] as const)
      await database.studentProfile.upsert({
        where: { id: profile[0] },
        create: {
          id: profile[0],
          userId: profile[1],
          studentNumber: profile[2],
          program: "Browser Verification Programme",
          academicYear: "YEAR_1",
        },
        update: { userId: profile[1], studentNumber: profile[2] },
      });
    await database.requestCategory.upsert({
      where: { id: categoryId },
      create: {
        id: categoryId,
        name: "V2-7 Browser Certificate",
        slug: "v2-7-browser-certificate",
        isActive: true,
      },
      update: { isActive: true },
    });
    await database.userCapabilityAssignment.deleteMany({
      where: { userId: { in: [staffId, zeroStaffId] } },
    });
    await database.userCapabilityAssignment.create({
      data: { userId: staffId, capability: "VIEW_AUDIT_LOG" },
    });
    const request = await database.documentRequest.create({
      data: {
        id: randomUUID(),
        studentId: profileAId,
        categoryId,
        status: "UNDER_REVIEW",
        deliveryMethod: "DIGITAL_DELIVERY",
        copyCount: 1,
      },
    });
    requestId = request.id;
    await database.notification.deleteMany({
      where: {
        id: {
          in: [
            studentNotificationId,
            privateStudentNotificationId,
            staffNotificationId,
          ],
        },
      },
    });
    await database.notification.createMany({
      data: [
        {
          id: studentNotificationId,
          userId: studentAId,
          requestId,
          eventType: "REQUEST_STATUS_CHANGED",
          eventKey: `v27-browser-status:${requestId}`,
          title: "Request status updated",
          body: "Your request is now under review.",
        },
        {
          id: privateStudentNotificationId,
          userId: studentBId,
          requestId: null,
          eventType: "REQUEST_PUBLIC_MESSAGE_ADDED",
          eventKey: `v27-browser-private:${requestId}`,
          title: "Other student's private notification",
          body: "Must remain private",
        },
        {
          id: staffNotificationId,
          userId: staffId,
          requestId,
          eventType: "REQUEST_SUBMITTED",
          eventKey: `v27-browser-staff:${requestId}`,
          title: "New student request",
          body: "A new request is ready for staff review.",
        },
      ],
    });
    await database.auditLog.create({
      data: {
        actorId: staffId,
        action: "V2_7_BROWSER_AUDIT",
        entityType: "V27BrowserFixture",
        entityId: requestId,
        metadata: {
          status: "UNDER_REVIEW",
          password: "never-render-this",
          nested: { secret: true },
        },
      },
    });
  });
});

test("student sees only owned notifications and can mark one then all read", async ({
  page,
}) => {
  await setSession(page, studentAId, "STUDENT");
  await page.goto("/student/notifications");
  await expect(
    page.getByRole("heading", { name: "Notification centre" }),
  ).toBeVisible();
  await expect(page.getByText("Request status updated")).toBeVisible();
  await expect(
    page.getByText("Other student's private notification"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Mark read" }).click();
  await expect(page.getByText("Unread")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mark all as read" }),
  ).toBeDisabled();
});

test("staff notification centre shows its operational event", async ({
  page,
}) => {
  await setSession(page, staffId, "STAFF");
  await page.goto("/staff/notifications");
  await expect(
    page.getByRole("heading", { name: "New student request" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View request" }),
  ).toHaveAttribute("href", `/staff/requests/${requestId}`);
});

test("audit viewer filters sanitized rows and zero-capability staff is denied", async ({
  page,
}) => {
  await setSession(page, staffId, "STAFF");
  await page.goto("/staff/audit?action=V2_7_BROWSER_AUDIT");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "V2_7_BROWSER_AUDIT" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("UNDER_REVIEW", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("never-render-this")).toHaveCount(0);
  await setSession(page, zeroStaffId, "STAFF");
  await page.goto("/staff/audit");
  await expect(page).toHaveURL(/\/unauthorized$/u);
});

for (const viewport of viewports)
  test(`notification and audit routes fit ${viewport.width}x${viewport.height} with accessible controls`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await setSession(page, staffId, "STAFF");
    for (const route of ["/staff/notifications", "/staff/audit"]) {
      await page.goto(route);
      await expectNoOverflow(page);
      await expectAccessibleControls(page);
    }
    await setSession(page, studentAId, "STUDENT");
    await page.goto("/student/notifications");
    await expectNoOverflow(page);
    await expectAccessibleControls(page);
  });

test("notification and audit routes preserve theme switching", async ({
  page,
}) => {
  await setSession(page, staffId, "STAFF");
  await page.goto("/staff/audit");
  const toggle = page.getByRole("button", { name: /theme/iu });
  const before = await page.locator("html").getAttribute("data-theme");
  await toggle.click();
  await expect
    .poll(() => page.locator("html").getAttribute("data-theme"))
    .not.toBe(before);
});
