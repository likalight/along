import { test, expect, type Page } from "@playwright/test";
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page), "No canvas runtime errors").toEqual([]);
});
async function say(page: Page, text: string) {
  const input = page.getByRole("textbox", { name: "Your shopping request" });
  await expect(input).toBeEnabled();
  await input.fill(text);
  await input.press("Enter");
  await expect(input).toBeEnabled();
}
async function start(page: Page, category = "Noisy café") {
  await page.goto("/canvas-preview");
  await expect(
    page.getByRole("heading", { name: "Let’s get the essentials right." }),
  ).toBeVisible();
  if (category !== "Noisy café") {
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(page.getByRole("textbox")).toBeEnabled();
  }
}
test("audio choices separate solution and priority; stable ranks and correctable budget", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  expect(await page.locator("[data-product-id]").count()).toBe(0);
  await say(page, "Under $100");
  await say(page, "Explore options");
  await expect(
    page.getByRole("heading", {
      name: "Three ways to bring your voice closer.",
    }),
  ).toBeVisible();
  expect(await page.locator("[data-product-id]").count()).toBe(0);
  await say(page, "Choose headset");
  await expect(
    page.getByRole("heading", { name: "What kind of good matters most?" }),
  ).toBeVisible();
  await say(page, "Choose quality regardless of cost");
  await expect(page.locator("[data-product-id]")).toHaveCount(2);
  await expect(page.getByText(/Fewer than three are eligible/)).toBeVisible();
  const ids = await page
    .locator("[data-product-id]")
    .evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-product-id")),
    );
  await say(page, "Focus the second");
  expect(
    await page
      .locator("[data-product-id]")
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute("data-product-id")),
      ),
  ).toEqual(ids);
  await expect(page.getByText("In focus", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/canvas-audio.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("bag collection narrows, saves, removes and restores without losing reference", async ({
  page,
}) => {
  await start(page, "Work + gym bag");
  await say(page, "Explore options");
  await expect(page.locator("[data-product-id]")).toHaveCount(5);
  await expect(page.getByText("Close match", { exact: true })).toHaveCount(2);
  await expect(
    page.getByText("Related discovery", { exact: true }),
  ).toHaveCount(3);
  await expect
    .poll(() =>
      page
        .locator("[data-product-id]")
        .last()
        .evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe("1");
  await page.screenshot({
    path: "test-results/canvas-discovery.png",
    fullPage: true,
  });
  await say(page, "I prefer the softer shape");
  await expect(page.locator("[data-product-id]")).toHaveCount(3);
  await expect(
    page.getByAltText("Prepared navy rounded bag reference · schematic"),
  ).toBeVisible();
  await expect(
    page.getByText("Under USD 150.00", { exact: true }),
  ).toBeVisible();
  await say(page, "Save the first");
  await say(page, "Remove the first");
  await expect(page.locator('[data-product-id="BAG-001"]')).toHaveCount(0);
  await say(page, "Restore shortlist");
  await expect(page.locator('[data-product-id="BAG-001"]')).toBeVisible();
  await say(page, "Show saved choices");
  await expect(page.locator("[data-product-id]")).toHaveCount(1);
  await expect(
    page.getByText(
      "Soft rounded silhouette; 22 L for your work + gym kit. Laptop sleeve + separate kit pocket.",
      { exact: true },
    ),
  ).toBeVisible();
});
test("comparison holds numbered identity and exposes explicit trade-offs", async ({
  page,
}) => {
  await start(page, "Work + gym bag");
  await say(page, "Explore options");
  await say(page, "Show more");
  await say(page, "Compare the first two");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Main compromise" }),
  ).toBeVisible();
  await expect(page.locator("[data-product-id]")).toHaveCount(2);
  const positions = await page
    .locator("[data-product-id]")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.getAttribute("data-product-id"),
        x: n.getBoundingClientRect().x,
        y: n.getBoundingClientRect().y,
      })),
    );
  await page.waitForTimeout(700);
  expect(
    await page.locator("[data-product-id]").evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.getAttribute("data-product-id"),
        x: n.getBoundingClientRect().x,
        y: n.getBoundingClientRect().y,
      })),
    ),
  ).toEqual(positions);
  await page.screenshot({
    path: "test-results/canvas-comparison.png",
    fullPage: true,
  });
});
test("curated video plays beside focused product with captions, stops, and gives takeaway", async ({
  page,
}) => {
  await start(page);
  await say(page, "Explore options");
  await say(page, "Choose desktop");
  await say(page, "Choose value");
  await say(page, "Reviews for the third");
  await say(page, "Play the first video");
  const video = page.getByLabel("Why microphone placement matters", {
    exact: true,
  });
  await expect(video).toBeVisible();
  await expect(page.locator('video track[kind="captions"]')).toHaveCount(1);
  await expect(
    page.getByText("Assistant narration paused · curated video playing"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/canvas-evidence.png",
    fullPage: true,
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Stop video" }).click();
  await expect(video).toHaveCount(0);
  await expect(page.getByText("The takeaway", { exact: true })).toBeVisible();
});
test("missing video and failed media stay explicit", async ({ page }) => {
  await start(page, "Work + gym bag");
  await say(page, "Explore options");
  await say(page, "Reviews for the first");
  await say(page, "Play the first video");
  await expect(
    page.getByText("No playable media is available for this product."),
  ).toBeVisible();
  await start(page);
  await say(page, "Explore options");
  await say(page, "Choose headset");
  await say(page, "Choose value");
  await say(page, "Reviews for the first");
  await page.route("**/placement.webm", (route) => route.abort());
  await say(page, "Play the first video");
  await expect(page.getByText(/Video failed to load/)).toBeVisible();
});
test("same-variant offers separate price/deadline and unknown totals", async ({
  page,
}) => {
  await start(page, "Work + gym bag");
  await say(page, "Explore options");
  await say(page, "Offers for the first");
  await say(page, "I need it tomorrow");
  await expect(page.getByText("USD 84.00", { exact: false })).toBeVisible();
  await expect(page.getByText("USD 99.00", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Misses your deadline", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Meets your deadline", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Total incomplete", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Seller evidence · proxy", { exact: true }),
  ).toHaveCount(3);
  await say(page, "Choose faster offer");
  await expect(
    page.getByRole("button", { name: "Selected for comparison" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/canvas-offers.png",
    fullPage: true,
  });
});
test("mobile reduced motion uses a readable strip and full-width focus sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  await say(page, "Explore options");
  await say(page, "Choose headset");
  await say(page, "Choose value");
  await say(page, "Focus the second");
  await expect(
    page.getByRole("region", { name: "Details for EarPods" }),
  ).toBeVisible();
  await expect(page.getByText("In focus", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const box = await page.locator("[data-product-id]").first().boundingBox();
  expect(box!.width).toBeGreaterThan(270);
  expect(
    await page
      .locator("[data-product-id]")
      .first()
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
  await page
    .getByRole("button", { name: "Seller offers", exact: true })
    .focus();
  await expect(
    page.getByRole("button", { name: "Seller offers", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: "test-results/canvas-mobile.png",
    fullPage: true,
  });
});

test("restricted bag counts and middle references follow the visible accepted order", async ({
  page,
}) => {
  await start(page, "Work + gym bag");
  await say(page, "Explore options");
  await say(page, "Focus the middle");
  await expect(page.locator('[data-product-id="BAG-003"]')).toContainText(
    "In focus",
  );
  await say(page, "Under $60");
  await say(page, "Explore options");
  await expect(page.locator("[data-product-id]")).toHaveCount(1);
  await expect(page.locator('[data-product-id="BAG-006"]')).toBeVisible();
  await expect(
    page.getByText(/Fewer|Only one|1 close match/i).first(),
  ).toBeVisible();
});

test("deep-pocket sheets expose the same exact variant on product and offers", async ({
  page,
}) => {
  await start(page, "Warm-room sheets");
  await say(page, "Mattress depth 40 cm");
  await say(page, "Explore options");
  await expect(page.locator("[data-product-id]")).toHaveCount(1);
  await expect(page.locator('[data-product-id="BED-005"]')).toContainText("40");
  await say(page, "Offers for the first");
  await expect(page.getByText(/40 cm pocket/).first()).toBeVisible();
  await expect(page.getByText(/30 cm pocket/)).toHaveCount(0);
});

test("unpriced required audio setup remains an incomplete total", async ({
  page,
}) => {
  await start(page);
  await say(page, "Explore options");
  await say(page, "Choose desktop");
  await say(page, "Choose value");
  await say(page, "Offers for the first");
  await expect(
    page.getByText("Total incomplete", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/Not available required setup/).first(),
  ).toBeVisible();
  await say(page, "Choose faster offer");
  await expect(
    page.getByRole("button", { name: "Selected for comparison" }),
  ).toHaveCount(0);
});

test("typed video stop provides a takeaway without restarting playback", async ({
  page,
}) => {
  await start(page);
  await say(page, "Explore options");
  await say(page, "Choose headset");
  await say(page, "Choose value");
  await say(page, "Reviews for the first");
  await say(page, "Play the first video");
  await expect(
    page.getByText("Assistant narration paused · curated video playing"),
  ).toBeVisible();
  await say(page, "Stop video");
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByText("The takeaway", { exact: true })).toBeVisible();
});

test("switching categories during video cannot carry old playback status", async ({
  page,
}) => {
  await start(page);
  await say(page, "Explore options");
  await say(page, "Choose headset");
  await say(page, "Choose value");
  await say(page, "Reviews for the first");
  await say(page, "Play the first video");
  await expect(
    page.getByText("Assistant narration paused · curated video playing"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Work + gym bag", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Let’s get the essentials right." }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator("footer").getByRole("status")).toHaveText(
    "Say it in the voice shell, or type it here.",
  );
});

test("stopping a still-loading video clears preparation without inventing playback", async ({
  page,
}) => {
  await start(page);
  await say(page, "Explore options");
  await say(page, "Choose headset");
  await say(page, "Choose value");
  await say(page, "Reviews for the first");
  let release: (() => void) | undefined;
  await page.route("**/placement.webm", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.abort().catch(() => {});
  });
  await say(page, "Play the first video");
  await expect(
    page.getByText("Preparing curated video…", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => !!release).toBe(true);
  await page.getByRole("button", { name: "Stop video" }).click();
  release!();
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator("footer").getByRole("status")).not.toContainText(
    "Preparing",
  );
  await expect(page.getByText("The takeaway", { exact: true })).toHaveCount(0);
});
