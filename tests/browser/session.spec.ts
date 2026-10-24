import { test, expect, Page } from "@playwright/test";
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("hydrated"))
      errors.push(m.text());
  });
});
test.afterEach(async ({ page }, testInfo) => {
  expect(browserErrors.get(page), "No runtime or hydration errors").toEqual([]);
  if (testInfo.status !== testInfo.expectedStatus) {
    console.log(await page.locator("body").innerText());
    await page.screenshot({
      path: testInfo.outputPath("failure.png"),
      fullPage: true,
    });
  }
});
async function installVoiceMock(page: Page) {
  await page.addInitScript(() => {
    let recognition: {
      onresult?: ((e: unknown) => void) | null;
      onstart?: (() => void) | null;
      active: boolean;
    } | null = null;
    let utterance: {
      onstart?: (() => void) | null;
      onend?: () => void;
    } | null = null;
    class FakeRecognition {
      continuous = true;
      interimResults = false;
      lang = "en-US";
      active = false;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      start() {
        recognition = this;
        this.active = true;
        queueMicrotask(() => this.onstart?.());
      }
      abort() {
        this.active = false;
      }
    }
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: FakeRecognition,
    });
    Object.defineProperty(window, "SpeechRecognition", {
      value: FakeRecognition,
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => ({ getTracks: () => [{ stop() {} }] }),
    });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak(u: typeof utterance) {
          utterance = u;
          queueMicrotask(() => u?.onstart?.());
        },
        cancel() {
          utterance = null;
        },
      },
    });
    Object.defineProperty(window, "__voice", {
      value: {
        say(text: string) {
          if (!recognition?.active) throw new Error("Microphone is inactive");
          recognition.onresult?.({
            resultIndex: 0,
            results: [{ isFinal: true, 0: { transcript: text } }],
          });
        },
        finish() {
          const u = utterance;
          utterance = null;
          u?.onend?.();
        },
        capturing() {
          return recognition?.active;
        },
      },
    });
  });
}
async function textMode(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start Chat" })).toBeEnabled();
  await page.getByRole("button", { name: "I’d rather type" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your message" }),
  ).toBeVisible();
}
async function say(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Your message" }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status").first()).not.toContainText("Thinking");
}
test("shopper opening and complete text journey, without presenter controls or unrelated products", async ({
  page,
}) => {
  await textMode(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little conversation",
  );
  await expect(page.getByText("Play demo")).toHaveCount(0);
  await expect(page.locator(".stage-card")).toHaveCount(0);
  await say(page, "a work and gym bag");
  await say(page, "shape, budget USD 150");
  await expect(page.locator(".stage-card")).toHaveCount(3);
  await say(page, "compare");
  await expect(page.locator(".stage-card")).toHaveCount(2);
  await say(page, "show evidence");
  await expect(
    page
      .getByRole("region", { name: "Shopping conversation" })
      .getByText("No verified buyer reviews or videos", { exact: false }),
  ).toBeVisible();
  await say(page, "show offers");
  await expect(page.locator(".stage-card")).toHaveCount(2);
  await say(page, "choose faster offer");
  await expect(
    page.getByRole("article", { name: "Complete current order summary" }),
  ).toContainText("USD 99.00");
  await say(page, "looks good");
  await expect(
    page.getByText("Simulated receipt", { exact: true }),
  ).toHaveCount(0);
  await say(page, "review summary");
  await say(page, "confirm simulated purchase");
  await expect(
    page.getByText("Simulated receipt", { exact: true }),
  ).toBeVisible();
});
test("photo and link validation, preparation, preview, removal and resolution failure", async ({
  page,
}) => {
  await textMode(page);
  await page.getByRole("button", { name: "Use prepared image" }).click();
  await expect(
    page.getByRole("img", { name: "Preview: Prepared navy bag" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share with concierge" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "What caught your eye",
  );
  await page.getByRole("button", { name: "Remove Prepared navy bag" }).click();
  await expect(
    page.getByRole("img", { name: "Preview: Prepared navy bag" }),
  ).toHaveCount(0);
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("invalid"),
  });
  await expect(
    page.getByText("Choose a JPG, PNG or WebP image of 5 MB or less."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add a link" }).click();
  await page
    .getByRole("textbox", { name: "Product or reference link" })
    .fill("https://unsupported.example/x");
  await page.getByRole("button", { name: "Resolve link" }).click();
  await expect(
    page.getByText("Unavailable in this demo.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Product or reference link" })
    .fill("https://demo.example/bags/navy");
  await page.getByRole("button", { name: "Resolve link" }).click();
  await expect(page.getByText("Supported · prepared reference")).toBeVisible();
});
test("microphone denial permits explicit text mode, no inactive listening animation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: class {},
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start Chat" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".orb-wrap")).not.toHaveClass(/capturing/);
  await page.getByRole("button", { name: "I’d rather type" }).click();
  await say(page, "bedsheets for a warm room");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "comfortable fit",
  );
});
test("narrow mobile, reduced motion and keyboard access", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await textMode(page);
  await say(page, "cafe dictation");
  await expect(page.locator(".orb-fallback")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("textbox", { name: "Your message" }).focus();
  await page.keyboard.type("choose headset");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "What matters most",
  );
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("presenter preview clearly separates controls and disconnected mail placeholders", async ({
  page,
}) => {
  await page.goto("/presenter");
  await expect(page.getByText("Presenter-only preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play demo / Replay entrance" }),
  ).toBeVisible();
  await expect(
    page.getByText("No OAuth or mailbox access is requested.", {
      exact: false,
    }),
  ).toBeVisible();
});

test("voice adapter completes the shopping path and never captures assistant narration", async ({
  page,
}) => {
  await installVoiceMock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start Chat" }).click();
  await expect(page.locator(".voice-status")).toContainText("Listening");
  const voiceSay = async (text: string) => {
    await page.evaluate(
      (t) =>
        (
          window as unknown as { __voice: { say: (t: string) => void } }
        ).__voice.say(t),
      text,
    );
    await expect(page.locator(".voice-status")).toContainText("Speaking");
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { __voice: { capturing: () => boolean } }
        ).__voice.capturing(),
      ),
    ).toBe(false);
  };
  const finish = async () => {
    await page.evaluate(() =>
      (
        window as unknown as { __voice: { finish: () => void } }
      ).__voice.finish(),
    );
    await expect(page.locator(".voice-status")).toContainText("Listening");
  };
  for (const text of [
    "cafe dictation",
    "choose headset",
    "best value",
    "compare",
    "show option 1",
    "show evidence",
    "show offers",
  ]) {
    await voiceSay(text);
    await finish();
  }
  await voiceSay("choose faster offer");
  await expect(
    page.getByRole("article", { name: "Complete current order summary" }),
  ).toContainText("Listen to the complete summary");
  await finish();
  await expect(
    page.getByRole("article", { name: "Complete current order summary" }),
  ).toContainText("Full summary displayed");
  await voiceSay("confirm simulated purchase");
  await expect(
    page.getByText("Simulated receipt", { exact: true }),
  ).toBeVisible();
});

test("switching from interrupted voice summary requires fresh text confirmation", async ({
  page,
}) => {
  await installVoiceMock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start Chat" }).click();
  await expect(page.locator(".voice-status")).toContainText("Listening");
  await page.evaluate(() =>
    (
      window as unknown as { __voice: { say: (t: string) => void } }
    ).__voice.say("bag"),
  );
  await expect(page.locator(".voice-status")).toContainText("Speaking");
  await page.evaluate(() =>
    (window as unknown as { __voice: { finish: () => void } }).__voice.finish(),
  );
  await expect(page.locator(".voice-status")).toContainText("Listening");
  await page.evaluate(() =>
    (
      window as unknown as { __voice: { say: (t: string) => void } }
    ).__voice.say("choose faster offer"),
  );
  await expect(page.locator(".voice-status")).toContainText("Speaking");
  await page.getByRole("button", { name: "Interrupt response" }).click();
  await page.getByRole("button", { name: "I’d rather type" }).click();
  const summary = page.getByRole("article", {
    name: "Complete current order summary",
  });
  await expect(summary).toContainText("TEXT CONFIRMATION");
  await expect(summary).toContainText(
    "No live seller, compatibility, stock or delivery verification",
  );
  await expect(
    page.getByText("Simulated receipt", { exact: true }),
  ).toHaveCount(0);
  await say(page, "confirm simulated purchase");
  await expect(
    page.getByText("Simulated receipt", { exact: true }),
  ).toBeVisible();
});

test("upload loading and network failure remain visible and removable", async ({
  page,
}) => {
  await textMode(page);
  let failUpload: (() => Promise<void>) | undefined;
  await page.route(
    "**/api/attachments",
    (route) =>
      new Promise<void>((resolve) => {
        failUpload = async () => {
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Photo service unavailable. Try again.",
            }),
          });
          resolve();
        };
      }),
  );
  await page
    .locator("input[type=file]")
    .setInputFiles("public/fixtures/perlin-noise.png");
  await expect(page.getByText("Preparing image…")).toBeVisible();
  await expect.poll(() => !!failUpload).toBe(true);
  await failUpload!();
  await expect(
    page.getByText("Photo service unavailable. Try again."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove perlin-noise.png" }).click();
  await expect(
    page.getByText("Photo service unavailable. Try again."),
  ).toHaveCount(0);
});

test("WebGL unavailability keeps a stable fallback and working text path", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await textMode(page);
  await say(page, "bag");
  await expect(page.locator(".orb-fallback")).toBeVisible();
  await expect(page.locator(".orb-wrap canvas")).toHaveCount(0);
});

test("typing retains focus while cancellation snapshots reconcile", async ({
  page,
}) => {
  await textMode(page);
  await say(page, "bag");
  const input = page.getByRole("textbox", { name: "Your message" });
  await input.pressSequentially("shape, budget USD 150", { delay: 60 });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("shape, budget USD 150");
  await input.press("Enter");
  await expect(page.locator(".stage-card")).toHaveCount(3);
});

test("removing a reference while its accepted share is delayed clears server state", async ({
  page,
}) => {
  await textMode(page);
  await page.getByRole("button", { name: "Use prepared image" }).click();
  await expect(
    page.getByRole("button", { name: "Share with concierge" }),
  ).toBeEnabled();
  let release: (() => void) | undefined;
  let sessionId = "";
  await page.route("**/api/session", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "input" && body.input?.attachmentId) {
      sessionId = body.input.sessionId;
      const response = await route.fetch();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Share with concierge" }).click();
  await expect.poll(() => !!release).toBe(true);
  await page.getByRole("button", { name: "Remove Prepared navy bag" }).click();
  release!();
  await expect(
    page.getByRole("img", { name: "Preview: Prepared navy bag" }),
  ).toHaveCount(0);
  await expect
    .poll(async () => {
      const response = await page.request.post("/api/session", {
        data: { action: "connect", sessionId },
      });
      return (await response.json()).attachmentIds;
    })
    .toEqual([]);
});

test("a removed pending upload cannot reappear after its response", async ({
  page,
}) => {
  await textMode(page);
  let release: (() => void) | undefined;
  await page.route("**/api/attachments", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ response }).catch(() => {});
  });
  await page.getByRole("button", { name: "Use prepared image" }).click();
  await expect(page.getByText("Preparing image…")).toBeVisible();
  await expect.poll(() => !!release).toBe(true);
  await page.getByRole("button", { name: "Remove Prepared navy bag" }).click();
  release!();
  await say(page, "bag");
  await expect(
    page.getByRole("list", { name: "References" }).getByRole("listitem"),
  ).toHaveCount(0);
});

test("WebGL context exceptions preserve the text journey", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => {
      throw new Error("GPU unavailable");
    };
  });
  await textMode(page);
  await say(page, "bag");
  await expect(page.locator(".orb-fallback")).toBeVisible();
});
