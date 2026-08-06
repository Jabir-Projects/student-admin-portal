import { expect, test, type Page } from "@playwright/test";
import { encode } from "@auth/core/jwt";
import type { PrismaClient } from "../../src/generated/prisma/client";

import { createPrismaClient } from "../../src/server/db/factory.node";
import {
  createSessionHistoryMarker,
  SESSION_HISTORY_COOKIE_NAME,
} from "../../src/features/auth/session-marker";
import { hashPassword } from "../../src/server/auth/password.node";
import { browserOnlyAuthSecret } from "./v2-5-test-environment";

const studentId = "98900000-0000-4000-8000-000000000001";
const profileId = "99000000-0000-4000-8000-000000000001";
const categoryId = "99100000-0000-4000-8000-000000000001";
const publicMessageId = "99200000-0000-4000-8000-000000000001";
const internalMessageId = "99200000-0000-4000-8000-000000000002";
const email = "v2-5-browser-student@example.test";
const password = "V2-5-Browser-Test-Password!";
const viewports = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function withDatabase<T>(
  operation: (database: PrismaClient) => Promise<T>,
): Promise<T> {
  if (!process.env.DATABASE_URL)
    throw new Error("V2-5 browser test database is unavailable.");
  const database = createPrismaClient(process.env.DATABASE_URL);
  try {
    return await operation(database);
  } finally {
    await database.$disconnect();
  }
}

test.beforeAll(async () => {
  await withDatabase(async (database) => {
    const passwordHash = await hashPassword(password);
    await database.user.upsert({
      where: { id: studentId },
      create: {
        id: studentId,
        email,
        fullName: "V2-5 Browser Student",
        passwordHash,
        role: "STUDENT",
        status: "ACTIVE",
        sessionVersion: 0,
      },
      update: {
        email,
        fullName: "V2-5 Browser Student",
        passwordHash,
        role: "STUDENT",
        status: "ACTIVE",
        sessionVersion: 0,
        disabledAt: null,
        disabledById: null,
      },
    });
    await database.studentProfile.upsert({
      where: { id: profileId },
      create: {
        id: profileId,
        userId: studentId,
        studentNumber: "V25BROWSER",
        program: "Browser Verification Programme",
        academicYear: "MASTER_1",
      },
      update: {
        userId: studentId,
        studentNumber: "V25BROWSER",
        program: "Browser Verification Programme",
        academicYear: "MASTER_1",
      },
    });
    await database.requestCategory.upsert({
      where: { id: categoryId },
      create: {
        id: categoryId,
        name: "Browser verification certificate",
        slug: "v2-5-browser-verification",
        description: "Deterministic browser-test category",
        isActive: true,
      },
      update: { isActive: true },
    });
    await database.documentRequest.updateMany({
      where: {
        studentId: profileId,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "READY"] },
      },
      data: { status: "CANCELLED" },
    });
  });
});

test.beforeEach(async () => {
  await withDatabase(async (database) => {
    await database.user.update({
      where: { id: studentId },
      data: {
        disabledAt: null,
        disabledById: null,
        role: "STUDENT",
        sessionVersion: 0,
        status: "ACTIVE",
      },
    });
    await database.documentRequest.updateMany({
      where: {
        studentId: profileId,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "READY"] },
      },
      data: { status: "CANCELLED" },
    });
  });
});

async function setSessionCookies(page: Page, sessionVersion = 0) {
  const sessionToken = await encode({
    maxAge: 8 * 60 * 60,
    salt: "authjs.session-token",
    secret: browserOnlyAuthSecret,
    token: {
      sub: studentId,
      role: "STUDENT",
      status: "ACTIVE",
      sessionVersion,
    },
  });
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

async function signIn(page: Page) {
  await setSessionCookies(page);
  await page.goto("/student");
  await expect(page).toHaveURL(/\/student$/u);
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const hasContainingScroller = (element: HTMLElement) => {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        const overflowX = getComputedStyle(ancestor).overflowX;
        if (
          ["auto", "hidden", "scroll"].includes(overflowX) &&
          ancestor.scrollWidth > ancestor.clientWidth
        ) {
          return true;
        }
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          className: element.className,
          clientWidth: element.clientWidth,
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          scrollWidth: element.scrollWidth,
          tagName: element.tagName,
        };
      })
      .filter(({ left, right }, index) => {
        const element = document.querySelectorAll<HTMLElement>("body *")[index];
        return (
          (left < -1 || right > Math.ceil(viewportWidth) + 1) &&
          element !== undefined &&
          !hasContainingScroller(element)
        );
      })
      .slice(0, 12);
  });
  expect(overflow).toEqual([]);
}

async function expectNoCriticalAccessibilityDefects(page: Page) {
  const defects = await page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input:not([type=hidden]), select, textarea"),
    );
    const interactive = Array.from(
      document.querySelectorAll<HTMLElement>("button, a[href], summary"),
    );
    const ids = Array.from(document.querySelectorAll<HTMLElement>("[id]"))
      .map((element) => element.id)
      .filter(Boolean);
    return {
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      unnamedControls: controls
        .filter(
          (control) =>
            control.labels?.length === 0 &&
            !control.getAttribute("aria-label") &&
            !control.getAttribute("aria-labelledby"),
        )
        .map((control) => control.tagName),
      unnamedInteractive: interactive
        .filter(
          (element) =>
            !element.textContent?.trim() &&
            !element.getAttribute("aria-label") &&
            !element.getAttribute("aria-labelledby"),
        )
        .map((element) => element.tagName),
    };
  });
  expect(defects).toEqual({
    duplicateIds: [],
    unnamedControls: [],
    unnamedInteractive: [],
  });
}

for (const viewport of viewports) {
  test(`student routes fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    for (const [path, heading] of [
      ["/student", /Welcome, V2-5 Browser Student/iu],
      ["/student/profile", "My profile"],
      ["/student/requests", "My requests"],
      ["/student/requests/new", "Request catalogue"],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expectNoOverflow(page);
      await expectNoCriticalAccessibilityDefects(page);
    }
  });
}

test("protected student routes enforce authentication and current account state", async ({
  page,
}) => {
  await page.goto("/student");
  await expect(page).toHaveURL(/\/login(?:\?|$)/u);

  await setSessionCookies(page);
  await withDatabase((database) =>
    database.user.update({
      where: { id: studentId },
      data: {
        status: "DISABLED",
        disabledAt: new Date(),
        disabledById: studentId,
      },
    }),
  );
  await page.goto("/student");
  await expect(page).toHaveURL(/\/login\?reason=disabled$/u);

  await withDatabase((database) =>
    database.user.update({
      where: { id: studentId },
      data: {
        status: "ACTIVE",
        disabledAt: null,
        disabledById: null,
        sessionVersion: 1,
      },
    }),
  );
  await page.goto("/student");
  await expect(page).toHaveURL(/\/login\?reason=session-ended$/u);
});

test("student submits, views, filters, and cancels an owned request", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/student/requests/new?category=${categoryId}`);
  await page.getByRole("radio", { name: "Digital delivery" }).check();
  await page.getByRole("spinbutton", { name: "Number of copies" }).fill("2");
  await page
    .getByRole("textbox", { name: /Additional details/iu })
    .fill("Browser-owned request details");
  const submitRequestButton = page.getByRole("button", {
    name: "Submit request",
  });
  await expect(
    await submitRequestButton.locator("..").evaluate((form) =>
      (form as HTMLFormElement).checkValidity(),
    ),
  ).toBe(true);
  await submitRequestButton.click();
  await expect(page).toHaveURL(
    /\/student\/requests\/[0-9a-f-]+\?submitted=1$/u,
    { timeout: 60_000 },
  );
  let requestId: string | undefined;
  await expect
    .poll(async () => {
      requestId = await withDatabase(
        async (database) =>
          (
            await database.documentRequest.findFirst({
              where: {
                studentId: profileId,
                categoryId,
                details: "Browser-owned request details",
                status: "SUBMITTED",
              },
              orderBy: { createdAt: "desc" },
              select: { id: true },
            })
          )?.id,
      );
      return requestId;
    })
    .toMatch(/^[0-9a-f-]{36}$/u);
  await page.goto(`/student/requests/${requestId}?submitted=1`);
  const requestUrl = page.url();
  await expect(
    page.getByText("Digital Delivery", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Browser-owned request details")).toBeVisible();
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/u);
  await withDatabase(async (database) => {
    await database.requestMessage.upsert({
      where: { id: publicMessageId },
      create: {
        id: publicMessageId,
        requestId: requestId!,
        visibility: "PUBLIC",
        body: "Public browser timeline message",
      },
      update: {
        requestId: requestId!,
        visibility: "PUBLIC",
        body: "Public browser timeline message",
      },
    });
    await database.requestMessage.upsert({
      where: { id: internalMessageId },
      create: {
        id: internalMessageId,
        requestId: requestId!,
        visibility: "INTERNAL",
        body: "Internal browser timeline message",
      },
      update: {
        requestId: requestId!,
        visibility: "INTERNAL",
        body: "Internal browser timeline message",
      },
    });
  });
  await page.reload();
  await expect(page.getByText("Public browser timeline message")).toBeVisible();
  await expect(page.getByText("Internal browser timeline message")).toHaveCount(
    0,
  );

  await page.goto(`/student/requests/new?category=${categoryId}`);
  await page.getByRole("radio", { name: "Digital delivery" }).check();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(
    page.getByText("You already have an open request in this category."),
  ).toBeVisible();

  await page.goto(requestUrl);
  await page.getByRole("button", { name: "Cancel request" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel this request?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Return" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Cancel request" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Cancel request" }).click();
  await dialog.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(
    page.getByText("Cancelled", { exact: true }).first(),
  ).toBeVisible({ timeout: 60_000 });
  await page.goto("/student/requests?status=CANCELLED");
  await expect(
    page.getByRole("link", { name: "View details" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Digital Delivery", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Cancel request" }),
  ).toHaveCount(0);

  await page.goto(`/student/requests/new?category=${categoryId}`);
  await page.getByRole("radio", { name: "Campus pickup" }).check();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page).toHaveURL(
    /\/student\/requests\/[0-9a-f-]+\?submitted=1$/u,
    { timeout: 60_000 },
  );
  await expect(page.getByText("Campus Pickup", { exact: true })).toBeVisible();
});

test("light and dark themes preserve the student dashboard", async ({
  page,
}) => {
  await signIn(page);
  const heading = page.getByRole("heading", {
    level: 1,
    name: /Welcome, V2-5 Browser Student/iu,
  });
  await expect(heading).toBeVisible();
  await page
    .getByRole("button", { name: "Toggle light and dark theme" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(heading).toBeVisible();
  await page
    .getByRole("button", { name: "Toggle light and dark theme" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("keyboard focus, account menu, and mobile drawer remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page);

  const drawerTrigger = page.getByRole("button", {
    name: "Open student navigation",
  });
  await drawerTrigger.focus();
  await expect(drawerTrigger).toBeFocused();
  const focusStyle = await drawerTrigger.evaluate((element) => {
    const style = getComputedStyle(element);
    return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle };
  });
  expect(
    focusStyle.boxShadow !== "none" || focusStyle.outlineStyle !== "none",
  ).toBe(true);
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", {
    name: "Student navigation drawer",
  });
  await expect(drawer).toBeVisible();
  expect(
    await drawer.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.getByRole("link", { name: "Profile" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    drawer.getByRole("link", { name: "SIST Student Portal" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(drawerTrigger).toBeFocused();

  const accountMenu = page.getByLabel("Open account menu");
  await accountMenu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expectNoCriticalAccessibilityDefects(page);
});
