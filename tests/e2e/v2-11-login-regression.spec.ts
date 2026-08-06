import { expect, test } from "@playwright/test";

test("public login route renders the accessible authentication form", async ({
  page,
}) => {
  const response = await page.goto("/login");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "SIST portal sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

  const registerLink = page
    .locator("#main-content")
    .getByRole("link", { name: "Register" });
  await registerLink.focus();
  await expect(registerLink).toBeFocused();
  await registerLink.press("Enter");
  await expect(page).toHaveURL(/\/register$/u);
  await expect(page.getByLabel("Full Name")).toBeVisible();
});

test("landing sign in reaches a rendered login page", async ({ page }) => {
  await page.goto("/");

  const signInLink = page
    .getByRole("complementary", { name: "Access the portal" })
    .getByRole("link", { name: "Sign in" });
  await signInLink.click();

  await expect(page).toHaveURL(/\/login$/u);
  await expect(
    page.getByRole("heading", { name: "SIST portal sign in" }),
  ).toBeVisible();
});

test("login and registration render at required viewports in both themes", async ({
  page,
}) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize(viewport);
      await page.addInitScript(
        (selectedTheme) =>
          localStorage.setItem("sist-color-theme", selectedTheme),
        theme,
      );
      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.goto("/register");
      await expect(page.getByLabel("Full Name")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    }
  }
});
