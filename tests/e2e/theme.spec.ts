import { type Page, expect, test } from "@playwright/test";

import { ADMIN_STATE, bookAppointment, registerPatient, startAsPatient } from "./helpers";

// UI-11: every page renders the dark theme with readable (light) text.
// Guards against the earlier bug where a client-side theme script was lost and pages showed
// black text on the dark background.
//
// Why measure colours instead of comparing screenshots (toHaveScreenshot)? Pixel baselines are
// different on Windows (local) and Linux (CI), so they would need two sets of images and redrawing
// after every design change. This check targets the actual bug and needs no baseline images.

type Problem = { text: string; color: string; background: string; ratio: number };

// For every visible element that directly contains text, find the colour actually behind it
// (the nearest ancestor with a non-transparent background) and compute the WCAG contrast ratio.
async function lowContrastText(page: Page, minRatio = 3): Promise<Problem[]> {
  return page.evaluate((min) => {
    // A 1x1 canvas turns any CSS colour format (rgb, rgba, oklch, color()) into RGBA bytes
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const toRgba = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const backgroundOf = (el: Element | null) => {
      for (; el; el = el.parentElement) {
        const bg = toRgba(getComputedStyle(el).backgroundColor);
        if (bg.a > 0.5) return { css: getComputedStyle(el).backgroundColor, rgba: bg };
      }
      return { css: "canvas default (white)", rgba: { r: 255, g: 255, b: 255, a: 1 } };
    };

    const problems: Problem[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      const ownText = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent!.trim())
        .join(" ")
        .trim();
      if (!ownText || !(el as HTMLElement).checkVisibility?.({ opacityProperty: true, visibilityProperty: true })) continue;
      if (el.closest("[aria-hidden='true'], script, style, noscript")) continue; // e.g. Radix's hidden <select>
      const style = getComputedStyle(el);
      const fg = toRgba(style.color);
      const bg = backgroundOf(el);
      // Semi-transparent text is drawn over its background, so blend before measuring
      const shown = {
        r: fg.r * fg.a + bg.rgba.r * (1 - fg.a),
        g: fg.g * fg.a + bg.rgba.g * (1 - fg.a),
        b: fg.b * fg.a + bg.rgba.b * (1 - fg.a),
      };
      const [l1, l2] = [luminance(shown), luminance(bg.rgba)].sort((a, b) => b - a);
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      if (ratio < min) problems.push({ text: ownText.slice(0, 40), color: style.color, background: bg.css, ratio: +ratio.toFixed(2) });
    }
    return problems;
  }, minRatio);
}

async function expectDarkAndReadable(page: Page) {
  // Dark mode is in the server-rendered HTML, not added later by a script
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  const { bodyBg, bodyText } = await page.evaluate(() => ({
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyText: getComputedStyle(document.body).color,
  }));
  expect(bodyBg, "page background should be dark").not.toBe("rgb(255, 255, 255)");
  expect(bodyText, "default text should be white").toBe("rgb(255, 255, 255)");
  expect(await lowContrastText(page), `low-contrast text on ${page.url()}`).toEqual([]);
}

test.describe("UI-11 dark theme and readable text on every page", () => {
  test("patient pages: home, admin modal, register, booking, success", async ({ page }) => {
    await page.goto("/");
    await expectDarkAndReadable(page);

    await page.goto("/?admin=true");
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expectDarkAndReadable(page);

    await startAsPatient(page);
    await expectDarkAndReadable(page);

    await registerPatient(page);
    await expectDarkAndReadable(page);

    await bookAppointment(page);
    await expect(page.getByRole("heading", { name: /successfully submitted/i })).toBeVisible();
    await expectDarkAndReadable(page);
  });

  test.describe("admin", () => {
    test.use({ storageState: ADMIN_STATE });

    test("admin dashboard", async ({ page }) => {
      await page.goto("/admin");
      await expect(page.getByRole("table")).toBeVisible();
      await expectDarkAndReadable(page);
    });
  });
});
