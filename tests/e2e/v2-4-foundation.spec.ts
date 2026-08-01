import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

const publicSurfaces = [
  { path: "/", heading: "Student Administration Portal" },
  { path: "/login", heading: "SIST portal sign in" },
  { path: "/register", heading: "Student account registration" },
  { path: "/pending-approval", heading: "Administrative approval pending" },
  { path: "/unauthorized", heading: "Permission denied" },
  { path: "/missing-v2-4-route", heading: "Page not found" },
] as const;

async function assertNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function bodyContrastRatio(page: Page) {
  return page.evaluate(() => {
    const parse = (value: string) =>
      value
        .match(/[\d.]+/gu)
        ?.slice(0, 3)
        .map(Number) ?? [0, 0, 0];
    const luminance = (rgb: number[]) => {
      const channels = rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (
        0.2126 * (channels[0] ?? 0) +
        0.7152 * (channels[1] ?? 0) +
        0.0722 * (channels[2] ?? 0)
      );
    };
    const style = getComputedStyle(document.body);
    const foreground = luminance(parse(style.color));
    const background = luminance(parse(style.backgroundColor));
    return (
      (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05)
    );
  });
}

for (const viewport of viewports) {
  test(`public and access foundations fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    for (const surface of publicSurfaces) {
      await page.goto(surface.path);
      await expect(
        page.getByRole("heading", { level: 1, name: surface.heading }),
      ).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Public navigation" }),
      ).toBeVisible();
      await assertNoPageOverflow(page);
    }
  });
}

test("light and dark themes remain readable and keep the same layout", async ({
  page,
}) => {
  await page.goto("/login");
  const heading = page.getByRole("heading", {
    level: 1,
    name: "SIST portal sign in",
  });
  const lightBox = await heading.boundingBox();
  const lightColors = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { background: style.backgroundColor, foreground: style.color };
  });
  expect(await bodyContrastRatio(page)).toBeGreaterThanOrEqual(4.5);

  await page
    .getByRole("button", { name: "Toggle light and dark theme" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkBox = await heading.boundingBox();
  const darkColors = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { background: style.backgroundColor, foreground: style.color };
  });

  expect(darkColors).not.toEqual(lightColors);
  expect(darkBox).toEqual(lightBox);
  expect(await bodyContrastRatio(page)).toBeGreaterThanOrEqual(4.5);
  await assertNoPageOverflow(page);

  await page.goto("/unauthorized");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", { level: 1, name: "Permission denied" }),
  ).toBeVisible();
});

test("authentication actions are keyboard reachable with visible focus", async ({
  page,
}) => {
  await page.goto("/login");
  const email = page.getByLabel("Email");
  for (let index = 0; index < 8; index += 1) {
    if (await email.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press("Tab");
  }
  await expect(email).toBeFocused();
  const outlineStyle = await email.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      boxShadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  const hasOutline =
    outlineStyle.outlineStyle !== "none" &&
    Number.parseFloat(outlineStyle.outlineWidth) > 0;
  const hasRing = outlineStyle.boxShadow !== "none";
  expect(hasOutline || hasRing).toBe(true);
});
