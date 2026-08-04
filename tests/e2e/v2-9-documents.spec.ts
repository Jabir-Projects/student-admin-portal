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

const ids = {
  staff: randomUUID(),
  zero: randomUUID(),
  studentA: randomUUID(),
  studentB: randomUUID(),
  profileA: randomUUID(),
  profileB: randomUUID(),
  category: randomUUID(),
} as const;
let digitalRequestId = "";
let campusRequestId = "";
let digitalArtifactId = "";
let campusArtifactId = "";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function withDatabase<T>(
  operation: (database: PrismaClient) => Promise<T>,
) {
  if (!process.env.DATABASE_URL)
    throw new Error("V2-9 browser database unavailable.");
  const database = createPrismaClient(process.env.DATABASE_URL);
  try {
    return await operation(database);
  } finally {
    await database.$disconnect();
  }
}

async function setSession(
  page: Page,
  actorId: string,
  role: "STAFF" | "STUDENT",
) {
  const token = await encode({
    maxAge: 8 * 60 * 60,
    salt: "authjs.session-token",
    secret: browserOnlyAuthSecret,
    token: { sub: actorId, role, status: "ACTIVE", sessionVersion: 0 },
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

test.beforeAll(async () => {
  await withDatabase(async (db) => {
    await db.user.createMany({
      data: [
        {
          id: ids.staff,
          email: `v2-9-browser-staff-${ids.staff}@example.test`,
          fullName: "V2-9 Browser Staff",
          passwordHash: "not-used",
          role: "STAFF",
          status: "ACTIVE",
        },
        {
          id: ids.zero,
          email: `v2-9-browser-zero-${ids.zero}@example.test`,
          fullName: "V2-9 Browser Zero",
          passwordHash: "not-used",
          role: "STAFF",
          status: "ACTIVE",
        },
        {
          id: ids.studentA,
          email: `v2-9-browser-a-${ids.studentA}@example.test`,
          fullName: "V2-9 Browser Student A",
          passwordHash: "not-used",
          role: "STUDENT",
          status: "ACTIVE",
        },
        {
          id: ids.studentB,
          email: `v2-9-browser-b-${ids.studentB}@example.test`,
          fullName: "V2-9 Browser Student B",
          passwordHash: "not-used",
          role: "STUDENT",
          status: "ACTIVE",
        },
      ],
    });
    await db.userCapabilityAssignment.createMany({
      data: [
        "GENERATE_DOCUMENTS",
        "RELEASE_DOCUMENTS",
        "REVOKE_DOCUMENTS",
        "PROCESS_REQUESTS",
      ].map((capability) => ({
        userId: ids.staff,
        capability: capability as
          | "GENERATE_DOCUMENTS"
          | "RELEASE_DOCUMENTS"
          | "REVOKE_DOCUMENTS"
          | "PROCESS_REQUESTS",
      })),
    });
    await db.studentProfile.createMany({
      data: [
        {
          id: ids.profileA,
          userId: ids.studentA,
          studentNumber: `V29A${ids.profileA}`.toUpperCase(),
          program: "Software Engineering",
          academicYear: "YEAR_3",
        },
        {
          id: ids.profileB,
          userId: ids.studentB,
          studentNumber: `V29B${ids.profileB}`.toUpperCase(),
          program: "Software Engineering",
          academicYear: "YEAR_3",
        },
      ],
    });
    await db.requestCategory.create({
      data: {
        id: ids.category,
        name: `V2-9 Browser Category ${ids.category}`,
        slug: `v2-9-browser-${ids.category}`,
        isActive: true,
      },
    });
    const [digital, campus] = await Promise.all([
      db.documentRequest.create({
        data: {
          studentId: ids.profileA,
          categoryId: ids.category,
          status: "READY",
          deliveryMethod: "DIGITAL_DELIVERY",
          copyCount: 1,
        },
      }),
      db.documentRequest.create({
        data: {
          studentId: ids.profileA,
          categoryId: ids.category,
          status: "READY",
          deliveryMethod: "CAMPUS_PICKUP",
          copyCount: 1,
        },
      }),
    ]);
    digitalRequestId = digital.id;
    campusRequestId = campus.id;
  });
});

test("STAFF generates, releases, and sees request integration", async ({
  page,
}) => {
  await setSession(page, ids.staff, "STAFF");
  await page.goto("/staff/documents");
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await page
    .locator(`form:has(input[value='${digitalRequestId}'])`)
    .getByRole("button", { name: "Generate PDF" })
    .click();
  await expect(page).toHaveURL(/result=success/u);
  digitalArtifactId = await withDatabase(
    async (db) =>
      (
        await db.documentArtifact.findFirstOrThrow({
          where: { requestId: digitalRequestId },
          orderBy: { version: "desc" },
        })
      ).id,
  );
  await page
    .locator(`form:has(input[value='${digitalArtifactId}'])`)
    .getByRole("button", { name: "Release" })
    .click();
  await expect
    .poll(() =>
      withDatabase(async (db) =>
        db.documentArtifact
          .findUniqueOrThrow({ where: { id: digitalArtifactId } })
          .then((artifact) => artifact.status),
      ),
    )
    .toBe("RELEASED");
  await page.goto(`/staff/requests/${digitalRequestId}`);
  await expect(
    page.getByRole("heading", { name: "Request documents" }),
  ).toBeVisible();
  await expect(page.getByText("Version 1")).toBeVisible();
  await expectNoOverflow(page);
});

test("student downloads released digital document and cross-student access is hidden", async ({
  page,
}) => {
  await setSession(page, ids.studentA, "STUDENT");
  await page.goto("/student/documents");
  await expect(
    page.getByRole("heading", { name: "My documents" }),
  ).toBeVisible();
  await page
    .locator(`a[href='/student/documents/${digitalArtifactId}']`)
    .click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/u);
  await setSession(page, ids.studentB, "STUDENT");
  const denied = await page.request.get(
    `/api/student/documents/${digitalArtifactId}/download`,
  );
  expect(denied.status()).toBe(404);
  expect(await denied.text()).not.toMatch(/storage|blob|vercel|token/iu);
});

test("campus pickup remains non-downloadable and revocation is generic", async ({
  page,
}) => {
  await setSession(page, ids.staff, "STAFF");
  await page.goto("/staff/documents");
  await page
    .locator(`form:has(input[value='${campusRequestId}'])`)
    .getByRole("button", { name: "Generate PDF" })
    .click();
  await expect(page).toHaveURL(/result=success/u);
  campusArtifactId = await withDatabase(
    async (db) =>
      (
        await db.documentArtifact.findFirstOrThrow({
          where: { requestId: campusRequestId },
          orderBy: { version: "desc" },
        })
      ).id,
  );
  await page
    .locator(`form:has(input[value='${campusArtifactId}'])`)
    .getByRole("button", { name: "Release" })
    .click();
  await expect
    .poll(() =>
      withDatabase(async (db) =>
        db.documentArtifact
          .findUniqueOrThrow({ where: { id: campusArtifactId } })
          .then((artifact) => artifact.status),
      ),
    )
    .toBe("RELEASED");
  await withDatabase(async (db) =>
    expect(
      (
        await db.documentRequest.findUniqueOrThrow({
          where: { id: campusRequestId },
        })
      ).status,
    ).toBe("READY"),
  );
  await page
    .locator(
      `form:has(input[value='${digitalArtifactId}']) input[name='reason']`,
    )
    .fill("Browser verified revocation");
  await page
    .locator(`form:has(input[value='${digitalArtifactId}'])`)
    .getByRole("button", { name: "Revoke" })
    .click();
  await expect
    .poll(() =>
      withDatabase(async (db) =>
        db.documentArtifact
          .findUniqueOrThrow({ where: { id: digitalArtifactId } })
          .then((artifact) => artifact.status),
      ),
    )
    .toBe("REVOKED");
  await setSession(page, ids.studentA, "STUDENT");
  await page.goto(`/student/documents/${digitalArtifactId}`);
  await expect(
    page.getByText("This document is no longer available for download."),
  ).toBeVisible();
  await expect(page.getByText("Browser verified revocation")).toHaveCount(0);
  await page.goto(`/student/requests/${campusRequestId}`);
  await expect(
    page.getByText(/campus pickup.*No digital download/iu),
  ).toBeVisible();
});

test("zero-capability STAFF is denied and document pages remain accessible across viewports and themes", async ({
  page,
}) => {
  await setSession(page, ids.zero, "STAFF");
  await page.goto("/staff/documents");
  await expect(page).toHaveURL(/\/unauthorized$/u);
  await setSession(page, ids.studentA, "STUDENT");
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/student/documents");
    await expectNoOverflow(page);
  }
  const theme = page.getByRole("button", { name: /theme/iu });
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches(
        "a,button,input,select,textarea,summary,[tabindex]:not([tabindex='-1'])",
      ),
    ),
  ).toBe(true);
  await expect(page.locator("body")).not.toContainText(
    /storageKey|vercel\.com|blob\.vercel-storage/iu,
  );
});
