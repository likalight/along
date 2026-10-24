import { test, expect, chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { cp, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("Mac preferences and the installed Chrome extension share one shopping journey", async ({
  baseURL,
}, info) => {
  const packaged = fileURLToPath(
    new URL("../../../extension/dist/along", import.meta.url),
  );
  const extension = await mkdtemp(path.join(tmpdir(), "along-e2e-"));
  await cp(packaged, extension, { recursive: true });
  const manifestPath = path.join(extension, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  expect(manifest.host_permissions).toBeUndefined();
  // Headless Chromium cannot accept the native optional-permission dialog.
  // Grant only this isolated test server in the test copy. All shipped JS,
  // consent controls, script registration and backend authentication are real.
  manifest.host_permissions = [
    `${new URL(baseURL!).protocol}//${new URL(baseURL!).hostname}/*`,
  ];
  await writeFile(manifestPath, JSON.stringify(manifest));
  // Chromium creates long nested storage paths; a temporary profile avoids
  // Windows MAX_PATH failures in deep checkout/test-result directories.
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    executablePath: process.env.CHROME_PATH,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
    viewport: { width: 1280, height: 900 },
  });
  context.setDefaultTimeout(15000);
  context.on("page", (p) =>
    p.on("pageerror", (error) =>
      console.error("Browser error:", error.message),
    ),
  );
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker", { timeout: 15000 }));
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    // Model-free fixture represents a previously learned, explicitly synthetic
    // Mac preference. This tests the real browser pairing and session injection.
    const memoryDirectory = process.env.ALONG_E2E_CONTEXT!;
    const pairing = JSON.parse(
      await readFile(path.join(memoryDirectory, "connection.json"), "utf8"),
    );
    const now = new Date().toISOString();
    await writeFile(
      path.join(memoryDirectory, "learned-preferences.json"),
      JSON.stringify({
        enabled: false,
        generation: 0,
        seen: [],
        suppressed: [],
        status: "Paused",
        lastSyncedAt: now,
        memories: [
          {
            id: "synthetic-weight",
            key: "bagPriority",
            value: "weight",
            confidence: 0.95,
            sourceApp: "TextEdit (synthetic demo)",
            sourceEventID: "synthetic-event",
            observedAt: now,
            learnedAt: now,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            origin: "inferred",
          },
        ],
      }),
      { mode: 0o600 },
    );
    await page.goto(`${baseURL}/context#pair=${pairing.token}`);
    await expect(
      page.getByText("TextEdit (synthetic demo)", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Start shopping with these preferences" })
      .click();
    await page.locator("summary").filter({ hasText: "Your context" }).click();
    await expect(
      page.getByRole("heading", { name: "Learning paused" }),
    ).toBeVisible();
    await expect(
      page.getByText("In this conversation", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("Priority: lightweight", { exact: true }),
    ).toHaveCount(2);
    await page.locator("summary").filter({ hasText: "Your context" }).click();
    await page.getByRole("button", { name: "Type instead" }).click();
    await page
      .getByRole("textbox", { name: "Your message" })
      .fill("a work and gym bag");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator(".voice-status")).toContainText("Ready");
    await page
      .getByRole("textbox", { name: "Your message" })
      .fill("shape, budget USD 150");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator(".voice-status")).toContainText("Ready");
    const sessionId = await page.evaluate(() =>
      sessionStorage.getItem("along.sessionId"),
    );
    expect(sessionId).toBeTruthy();
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${id}/ui/panel.html?setup`);
    await expect(panel.locator("#setup")).toBeVisible();
    await panel.locator("#backend").fill(baseURL!);
    await panel.locator("#consent").check();
    await panel.locator("#demo").check();
    await panel.locator("#connect").click();
    await expect
      .poll(
        async () =>
          (
            await panel.evaluate(async () =>
              (globalThis as any).chrome.permissions.getAll(),
            )
          ).origins,
      )
      .toContain("http://127.0.0.1/*");
    await expect(
      page.getByRole("button", { name: "Connect extension", exact: true }),
    )
      .toBeVisible({ timeout: 5000 })
      .catch(async (error) => {
        console.log("PANEL", await panel.locator("body").innerText());
        console.log(
          "STATE",
          await panel.evaluate(async () =>
            (globalThis as any).chrome.runtime.sendMessage({
              type: "ALONG_STATE",
            }),
          ),
        );
        console.log(
          "PAGES",
          context.pages().map((p) => p.url()),
        );
        throw error;
      });
    await page
      .getByRole("button", { name: "Connect extension", exact: true })
      .click();
    await expect(
      page.getByText("Your Chrome companion is connected"),
    ).toBeVisible();
    await expect(panel.locator("#connection-label")).toHaveText(
      "Your conversation is connected",
    );
    // A newer unrelated Along tab must never become the handoff destination.
    const unrelated = await context.newPage();
    await unrelated.goto(baseURL!);
    await expect(
      unrelated.getByRole("button", { name: "Start talking" }),
    ).toBeEnabled();
    expect(
      await unrelated.evaluate(() => sessionStorage.getItem("along.sessionId")),
    ).not.toBe(sessionId);
    await page
      .getByRole("textbox", { name: "Your message" })
      .fill("Keep my unfinished thought");
    await panel.bringToFront();
    const demoPromise = context.waitForEvent("page");
    await panel.locator("#demo-site").click();
    const demo = await demoPromise;
    await demo.waitForLoadState();
    await demo.bringToFront();
    await expect(demo.locator("[data-along-companion]")).toBeVisible({
      timeout: 30000,
    });
    await demo.screenshot({
      path: info.outputPath("automatic-nudge.png"),
      fullPage: true,
    });
    await panel.bringToFront();
    await expect(panel.locator(".discuss").first()).toBeVisible();
    await panel.locator("#settings-toggle").click();
    await panel.setViewportSize({ width: 390, height: 850 });
    await expect(panel.locator("#intro")).toBeHidden();
    const actionBounds = await panel.locator(".discuss").first().boundingBox();
    expect(actionBounds!.y + actionBounds!.height).toBeLessThan(850);
    await panel.screenshot({
      path: info.outputPath("extension-panel.png"),
      fullPage: true,
    });
    await panel.locator(".discuss").first().click();
    await expect(
      page.getByRole("button", { name: "Bring into conversation" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("textbox", { name: "Your message" }),
    ).toHaveValue("Keep my unfinished thought");
    await expect(
      page.getByRole("article", { name: "Discovery in this conversation" }),
    ).toHaveCount(0);
    await expect(
      unrelated.getByRole("article", {
        name: "Discovery in this conversation",
      }),
    ).toHaveCount(0);
    await page.getByRole("textbox", { name: "Your message" }).fill("");
    await expect(
      page.getByRole("article", { name: "Discovery in this conversation" }),
    ).toBeVisible({ timeout: 15000 });
    expect(
      await page.evaluate(() => sessionStorage.getItem("along.sessionId")),
    ).toBe(sessionId);
    await expect(
      page.getByText("DEMO DISCOVERY", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Check my requirements", exact: true })
      .click();
    await expect(page.locator(".voice-status")).toContainText("Ready");
    await expect(
      page.getByRole("region", { name: "How this fits your needs" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "How this fits your needs" }),
    ).toContainText("150");
    await page.screenshot({
      path: info.outputPath("same-conversation.png"),
      fullPage: true,
    });
    await page
      .getByRole("textbox", { name: "Your message" })
      .fill("show offers");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator(".voice-status")).toContainText("Ready");
    await expect(
      page.getByRole("article", { name: "Discovery in this conversation" }),
    ).toBeVisible();
    await expect(
      page.getByText(/cannot purchase it here/).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Explore this demo product", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: "Discovery in this conversation" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => sessionStorage.getItem("along.sessionId")),
    ).toBe(sessionId);
    // The source product continues into the same catalog identity and a reviewed
    // simulated order. A nudge or handoff alone never places that order.
    const send = async (text: string) => {
      await page.getByRole("textbox", { name: "Your message" }).fill(text);
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/session") &&
          r.request().postDataJSON()?.input?.text === text,
      );
      await page.getByRole("button", { name: "Send message" }).click();
      const result = await response;
      expect(result.status()).toBe(200);
      await expect(page.locator(".voice-status")).toContainText("Ready");
      return result.json();
    };
    await expect(
      page.getByRole("region", { name: "Order confirmation" }),
    ).toHaveCount(0);
    await send("show offers");
    await expect(
      page.getByText("Offers for this product", { exact: true }),
    ).toBeVisible();
    await send("choose faster offer");
    const review = page.getByRole("article", {
      name: "Complete current order summary",
    });
    await expect(review).toContainText("Daylite Large Tote Pack");
    await expect(review).toHaveAttribute("data-summary-status", "eligible");
    const completed = await send("Yes, go ahead and place the order");
    // The explicit "shape" request supersedes the remembered weight preference.
    expect(completed.snapshot.preferences).toContain("bagPriority: shape");
    expect(completed.snapshot.receipt.simulated).toBe(true);
    expect(completed.snapshot.receipt.acceptedOrder.productId).toBe("BAG-001");
    await expect(
      page.getByRole("region", { name: "Order confirmation" }),
    ).toContainText("Order confirmed");
    await page.screenshot({
      path: info.outputPath("discovery-to-simulated-order.png"),
      fullPage: true,
    });
    await panel.bringToFront();
    await panel.locator("#pause").click();
    await demo.bringToFront();
    await expect(demo.locator("[data-along-companion]")).toHaveCount(0, {
      timeout: 15000,
    });
    await panel.bringToFront();
    await panel.locator("#settings-toggle").click();
    await panel.locator("#consent").uncheck();
    await expect(panel.locator("#scan-state")).toContainText("Paused");
    const state = await panel.evaluate(async () =>
      (globalThis as any).chrome.runtime.sendMessage({ type: "ALONG_STATE" }),
    );
    expect(state.settings.enabledOrigins).toEqual([]);
    expect(state.settings.visual).toBe(false);
    await panel.locator("#disconnect").click();
    await expect(
      page.getByText("Your Chrome companion is connected"),
    ).toHaveCount(0);
    await page.bringToFront();
    await page
      .getByRole("button", { name: "Reconnect extension", exact: true })
      .click();
    await expect(
      page.getByText("Your Chrome companion is connected"),
    ).toBeVisible();
    expect(
      await page.evaluate(() => sessionStorage.getItem("along.sessionId")),
    ).toBe(sessionId);
    // Starting over keeps the paired Mac memory but not the old order or
    // extension session. The same extension must pair with the new session.
    await page.locator("summary").filter({ hasText: "Your context" }).click();
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Start talking" }),
    ).toBeEnabled();
    const freshId = await page.evaluate(() =>
      sessionStorage.getItem("along.sessionId"),
    );
    expect(freshId).toBeTruthy();
    expect(freshId).not.toBe(sessionId);
    await expect(
      page.getByRole("region", { name: "Order confirmation" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Your Chrome companion is connected"),
    ).toHaveCount(0);
    await page.locator("summary").filter({ hasText: "Your context" }).click();
    await expect(
      page.getByText("Priority: lightweight", { exact: true }),
    ).toHaveCount(2);
    await page
      .getByRole("button", { name: /^(Re)?connect extension$/i })
      .click();
    await expect(
      page.getByText("Your Chrome companion is connected"),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("unified-context.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
    const memoryDirectory = process.env.ALONG_E2E_CONTEXT;
    if (
      memoryDirectory &&
      path.dirname(memoryDirectory) === path.resolve(tmpdir()) &&
      path.basename(memoryDirectory).startsWith("along-context-e2e-")
    )
      await rm(memoryDirectory, { recursive: true, force: true });
    if (
      path.dirname(extension) !== path.resolve(tmpdir()) ||
      !path.basename(extension).startsWith("along-e2e-")
    )
      throw new Error("Invalid temporary extension path");
    await rm(extension, { recursive: true, force: true });
  }
});
