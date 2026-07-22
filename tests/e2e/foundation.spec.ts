import { expect, test } from "@playwright/test";

test("landing page presents the portal foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Student Administration Portal",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "SIST - Superior Institute of Science and Technology",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "New student accounts require administrative approval before portal access.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
  await expect(
    page.getByRole("link", { name: "Create account" }),
  ).toHaveAttribute("href", "/register");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "How it works",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Student administration request process" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /SIST/u })).toHaveCount(1);
  await expect(page.getByText(/REQ-\d+/u)).toHaveCount(0);
});

for (const width of [320, 375, 768, 1024, 1280, 1440]) {
  test(
    "landing page has no horizontal overflow at " + width + "px",
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const heading = page.getByRole("heading", {
        level: 1,
        name: "Student Administration Portal",
      });

      const hasHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);

      const headingTypography = await heading.evaluate((element) => {
        const style = getComputedStyle(element);

        return {
          fontSize: Number.parseFloat(style.fontSize),
          fontStyle: style.fontStyle,
        };
      });
      expect(headingTypography.fontStyle).toBe("normal");
      expect(headingTypography.fontSize).toBeLessThanOrEqual(52);

      const logoLoaded = await page
        .getByRole("img", {
          name: "SIST - Superior Institute of Science and Technology",
        })
        .evaluate(
          (image) =>
            image instanceof HTMLImageElement && image.naturalWidth > 0,
        );
      expect(logoLoaded).toBe(true);
    },
  );
}

test("unknown routes show the custom not-found page", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");

  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
});
