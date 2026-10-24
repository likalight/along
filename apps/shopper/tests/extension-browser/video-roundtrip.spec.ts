import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("Wireless PRO video opens through the extension and returns to the same shopping session", async ({
  baseURL,
}, info) => {
  const extension = await mkdtemp(path.join(tmpdir(), "along-video-e2e-"));
  await cp(
    fileURLToPath(new URL("../../../extension/dist/along", import.meta.url)),
    extension,
    { recursive: true },
  );
  const manifest = JSON.parse(
    await readFile(path.join(extension, "manifest.json"), "utf8"),
  );
  // Test-only permissions; the distributed extension still requests these explicitly.
  manifest.host_permissions = [
    "http://127.0.0.1/*",
    "https://www.youtube.com/*",
  ];
  await writeFile(
    path.join(extension, "manifest.json"),
    JSON.stringify(manifest),
  );
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
  try {
    // Deterministic YouTube surface: real extension navigation and return scripts,
    // but no claim that this fixture verifies YouTube playback or media quality.
    await context.route("https://www.youtube.com/shorts/WCsWHqMdPJI", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><meta charset="utf-8"><title>Video fixture</title><main><h1>Wireless PRO review — test surface</h1><video controls></video></main>',
      }),
    );
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(baseURL!);
    await expect(
      page.getByRole("button", { name: "Start talking", exact: true }),
    ).toBeEnabled();
    await expect(page.getByText("FROM YOUR MAC", { exact: true })).toHaveCount(
      0,
    );
    await page.locator("summary").filter({ hasText: "Settings" }).click();
    await page
      .getByRole("button", { name: "Show context & connections" })
      .click();
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${id}/ui/panel.html?setup=1`);
    await panel.locator("#backend").fill(baseURL!);
    await panel.locator("#connect").click();
    await page
      .getByRole("button", { name: "Connect extension", exact: true })
      .click();
    await expect(
      page.getByText("Your Chrome companion is connected"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Type instead" }).click();
    await page
      .getByRole("textbox", { name: "Your message" })
      .fill("Show catalog MIC-062");
    await page.getByRole("button", { name: "Send message" }).click();
    const watch = page.getByRole("button", {
      name: "Watch review",
      exact: true,
    });
    await expect(watch).toBeEnabled();
    const sessionId = await page.evaluate(() =>
      sessionStorage.getItem("along.sessionId"),
    );
    await page
      .getByRole("textbox", { name: "Your message" })
      .fill("Keep this unfinished thought");
    const videoPromise = context.waitForEvent("page");
    await watch.click();
    const video = await videoPromise;
    await expect(video).toHaveURL("https://www.youtube.com/shorts/WCsWHqMdPJI");
    const back = video.getByRole("button", {
      name: "Back to Along",
      exact: true,
    });
    await expect(back).toBeVisible();
    await expect(page.locator(".voice-status")).toContainText("Paused");
    await video.screenshot({
      path: info.outputPath("video-return-control.png"),
    });
    await back.click();
    await expect.poll(() => video.isClosed()).toBe(true);
    await expect(
      page.getByRole("textbox", { name: "Your message" }),
    ).toHaveValue("Keep this unfinished thought");
    expect(
      await page.evaluate(() => sessionStorage.getItem("along.sessionId")),
    ).toBe(sessionId);
    await expect(
      page.getByRole("button", { name: "Continue conversation", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".voice-status")).toContainText("Paused");
    await page.screenshot({
      path: info.outputPath("back-to-same-conversation.png"),
      fullPage: true,
    });
    const state = await panel.evaluate(async () =>
      (globalThis as any).chrome.runtime.sendMessage({ type: "ALONG_STATE" }),
    );
    expect(state.settings.enabledOrigins).toEqual([]);
    expect(state.settings.visual).toBe(false);
    expect(state.results).toEqual([]);
  } finally {
    await context.close();
    await rm(extension, { recursive: true, force: true });
  }
});
