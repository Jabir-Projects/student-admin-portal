import { expect, test } from "@playwright/test";

test("student registration exposes only approved fields", async ({ page }) => {
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Student account registration" }),
  ).toBeVisible();
  await expect(page.getByLabel("Full Name")).toBeVisible();
  await expect(page.getByLabel("Preferred Language")).toHaveCount(0);
  await expect(page.getByLabel("Role")).toHaveCount(0);
});

test("unauthenticated protected routes redirect to login", async ({ page }) => {
  await page.goto("/admin/users/pending");
  await expect(page).toHaveURL(/\/login/u);
});

test("login uses email and password only", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByText("Forgot password")).toHaveCount(0);
});
