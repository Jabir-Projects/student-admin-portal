import { expect, test } from "@playwright/test";

test("landing page presents the portal foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Administration requests, without the uncertainty.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Portal access will be enabled")).toBeVisible();
});

test("unknown routes show the custom not-found page", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");

  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
});
