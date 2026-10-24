import { test, expect, type Page } from "@playwright/test";
import type { AcceptedEvent } from "../../../lib/canvas/contracts";
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
  const response = page.waitForResponse(
    (reply) =>
      new URL(reply.url()).pathname === "/api/canvas" &&
      reply.request().method() === "POST" &&
      reply.request().postDataJSON().text === text,
  );
  await input.press("Enter");
  const reply = await response;
  expect(reply.ok()).toBe(true);
  const body: { event: AcceptedEvent } = await reply.json();
  await expect(
    page.getByText(`Accepted revision ${body.event.revision}`, { exact: true }),
  ).toBeVisible();
  await expect(input).toBeEnabled();
  return body.event.snapshot;
}
const options = (page: Page) =>
  page.getByRole("button", { name: /^Focus option \d+:/ });
async function start(page: Page, category = "Noisy café") {
  await page.goto("/canvas-preview");
  await expect(
    page.getByRole("textbox", { name: "Your shopping request" }),
  ).toBeEnabled();
  if (category !== "Noisy café") {
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(page.getByRole("textbox")).toBeEnabled();
  }
  await expect(
    page.getByRole("button", { name: category, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
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
    page.getByRole("region", { name: "Microphone setups" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Microphone setups" }).getByRole("button"),
  ).toHaveCount(3);
  expect(await page.locator("[data-product-id]").count()).toBe(0);
  await say(page, "Choose headset");
  await expect(
    page.getByRole("region", { name: "Choose a buying priority" }),
  ).toBeVisible();
  const shortlist = await say(page, "Choose quality regardless of cost");
  expect(shortlist.hardConstraints.budgetMinor).toBe("10000");
  expect(shortlist.displayOrder).toEqual(["MIC-003", "MIC-001"]);
  await expect(options(page)).toHaveCount(2);
  await expect(page.locator("[data-product-id]")).toHaveCount(1);
  await expect(page.getByText("2 options", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Image carousel" }),
  ).toBeVisible();
  const labels = await options(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label")),
  );
  const focused = await say(page, "Focus the second");
  expect(focused.displayOrder).toEqual(shortlist.displayOrder);
  expect(
    await options(page).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label")),
    ),
  ).toEqual(labels);
  await expect(options(page).nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-product-id="MIC-001"]')).toHaveAttribute(
    "data-number",
    "2",
  );
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
  const discovery = await say(page, "Explore options");
  await expect(options(page)).toHaveCount(5);
  expect(
    discovery.displayOrder.map((id) => discovery.canvas.annotations[id].role),
  ).toEqual([
    "Close match",
    "Close match",
    "Related discovery",
    "Related discovery",
    "Related discovery",
  ]);
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
  const narrowed = await say(page, "I prefer the softer shape");
  await expect(options(page)).toHaveCount(3);
  expect(narrowed.displayOrder).toEqual(["BAG-001", "BAG-002", "BAG-003"]);
  await expect(
    page.getByAltText("Prepared navy rounded bag reference · schematic"),
  ).toBeVisible();
  expect(narrowed.hardConstraints.budgetMinor).toBe("15000");
  await say(page, "Save the first");
  await say(page, "Remove the first");
  await expect(page.locator('[data-product-id="BAG-001"]')).toHaveCount(0);
  await expect(options(page)).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: /Focus option \d+: Dayform$/ }),
  ).toHaveCount(0);
  await say(page, "Restore shortlist");
  await expect(page.locator('[data-product-id="BAG-001"]')).toBeVisible();
  const saved = await say(page, "Show saved choices");
  await expect(options(page)).toHaveCount(1);
  await expect(page.locator("[data-product-id]")).toHaveCount(1);
  const rationale =
    "Soft rounded silhouette; 22 L for your work + gym kit. Laptop sleeve + separate kit pocket.";
  expect(saved.savedItems).toEqual([{ id: "BAG-001", rationale }]);
  await expect(page.locator('[data-product-id="BAG-001"]')).toContainText(
    rationale,
  );
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
  await expect(page.getByRole("heading", { name: /USD 84\.00/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /USD 99\.00/ })).toBeVisible();
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
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review this offer" }),
  ).toHaveCount(3);
  const selected = await say(page, "Choose faster offer");
  expect(selected.selectedOfferId).toBe("BAG-001-fast");
  await expect(
    page.getByRole("button", { name: "Selected offer" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/canvas-offers.png",
    fullPage: true,
  });
});
test("mobile reduced motion uses a static image and readable product details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  await say(page, "Explore options");
  await say(page, "Choose headset");
  await say(page, "Choose value");
  await say(page, "Focus the second");
  await expect(options(page).nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-product-id="MIC-001"]')).toHaveAttribute(
    "data-number",
    "2",
  );
  await expect(
    page.getByRole("region", { name: "Product choices" }),
  ).toHaveAttribute("data-reduced", "true");
  await expect(
    page.getByRole("region", { name: "Image carousel" }),
  ).toHaveCount(0);
  await page.getByText("Product details", { exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Details for EarPods" }),
  ).toBeVisible();
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
  await expect(options(page).nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-product-id="BAG-003"]')).toHaveAttribute(
    "data-number",
    "3",
  );
  await say(page, "Under $60");
  const restricted = await say(page, "Explore options");
  expect(restricted.hardConstraints.budgetMinor).toBe("6000");
  expect(restricted.displayOrder).toEqual(["BAG-006"]);
  await expect(options(page)).toHaveCount(1);
  await expect(page.locator("[data-product-id]")).toHaveCount(1);
  await expect(page.locator('[data-product-id="BAG-006"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Previous product" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Next product" }),
  ).toBeDisabled();
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
  await expect(
    page.getByRole("button", { name: "Review this offer" }),
  ).toHaveCount(3);
  for (const offer of await page
    .getByRole("button", { name: "Review this offer" })
    .all())
    await expect(offer).toBeDisabled();
  const unchanged = await say(page, "Choose faster offer");
  expect(unchanged.selectedOfferId).toBeNull();
  await expect(
    page.getByRole("button", { name: "Selected offer" }),
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
    page.getByRole("button", { name: "Work + gym bag", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("textbox", { name: "Your shopping request" }),
  ).toBeEnabled();
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
