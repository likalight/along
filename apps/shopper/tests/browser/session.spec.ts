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
  await expect(
    page.getByRole("button", { name: /Start talking|Talk to Along/ }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Type instead" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your message" }),
  ).toBeVisible();
}
async function say(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Your message" }).fill(text);
  const submitted = page.waitForResponse((response) => {
    if (
      !response.url().endsWith("/api/session") ||
      response.request().method() !== "POST"
    )
      return false;
    const body = response.request().postDataJSON();
    return body.action === "input" && body.input?.text === text;
  });
  await page.getByRole("button", { name: "Send message" }).click();
  await submitted;
  await expect(page.locator(".voice-status")).toContainText("Ready");
}
async function openSettings(page: Page) {
  await page
    .locator("summary")
    .filter({ hasText: /^Settings$/ })
    .click();
}
function confirmation(page: Page) {
  return page.getByRole("region", { name: "Order confirmation" });
}
/** ProductCanvas discovery tiles — Option N product cards (not offer/evidence articles). */
function canvasArticles(page: Page) {
  return page
    .getByRole("region", { name: "Shopping product canvas" })
    .locator("article")
    .filter({ hasText: /^Option\s+\d+/ });
}
function carouselChoices(page: Page) {
  return page
    .getByRole("region", { name: "Product choices" })
    .getByRole("button", { name: /^Focus option \d+:/ });
}
const preparedImage = "Prepared blue tote illustration";
test("recovered expired sessions initialize voice without turning on the microphone", async ({
  page,
  baseURL,
}) => {
  const expiredSessionId = crypto.randomUUID();
  await installVoiceMock(page);
  await page.context().addCookies([
    {
      name: `along-session-${expiredSessionId}`,
      value: "stale-token-from-before-server-restart",
      url: baseURL!,
    },
  ]);
  await page.addInitScript((id) => {
    sessionStorage.setItem("along.sessionId", id);
  }, expiredSessionId);
  const configuredSessions: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/voice/mint"))
      configuredSessions.push(request.postDataJSON().sessionId);
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  const start = page.getByRole("button", {
    name: "Start talking",
    exact: true,
  });
  await expect(start).toBeDisabled();
  expect(configuredSessions).toEqual([]);
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(start).toBeEnabled();
  const recoveredId = await page.evaluate(() =>
    sessionStorage.getItem("along.sessionId"),
  );
  expect(recoveredId).toBeTruthy();
  expect(recoveredId).not.toBe(expiredSessionId);
  expect(configuredSessions).toContain(recoveredId);
  expect(configuredSessions).not.toContain(expiredSessionId);
  expect(
    await page.evaluate(() => (window as any).__voice.capturing()),
  ).toBeFalsy();
  await start.click();
  await expect(
    page.getByRole("button", { name: "Pause microphone" }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__voice.capturing())).toBe(
    true,
  );
});
test("shopper opening and complete text journey, without presenter controls or unrelated products", async ({
  page,
}) => {
  await textMode(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "What are you looking for?",
  );
  await expect(page.getByText("Play demo")).toHaveCount(0);
  await expect(canvasArticles(page)).toHaveCount(0);
  await say(page, "a work and gym bag");
  await say(page, "shape, budget USD 150");
  await expect(carouselChoices(page)).toHaveCount(3);
  await expect(canvasArticles(page)).toHaveCount(1);
  await say(page, "compare");
  await expect(canvasArticles(page)).toHaveCount(2);
  await say(page, "show evidence");
  await expect(
    page.getByRole("heading", { name: "What supports this choice?" }),
  ).toBeVisible();
  await say(page, "show offers");
  await expect(
    page.getByText("Offers for this product", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Review this offer|Selected offer/i).first(),
  ).toBeVisible();
  await say(page, "choose faster offer");
  await expect(
    page.getByRole("article", { name: "Complete current order summary" }),
  ).toContainText(/USD \d+\.\d{2}/);
  await say(page, "Not yet, I want to review the summary");
  await expect(confirmation(page)).toHaveCount(0);
  await say(page, "review summary");
  await expect(
    page.getByRole("article", { name: "Complete current order summary" }),
  ).toHaveAttribute("data-summary-status", "eligible");
  await say(page, "Yes I approved this, can we just buy this");
  await expect(confirmation(page)).toContainText("Order confirmed");
  await expect(confirmation(page)).toContainText(/USD \d+\.\d{2}/);
  await expect(
    confirmation(page).getByRole("heading", { name: "You’re all set." }),
  ).toBeVisible();
});
test("photo and link validation, preparation, preview, removal and resolution failure", async ({
  page,
}) => {
  await textMode(page);
  await openSettings(page);
  await page.getByRole("button", { name: "Use prepared image" }).click();
  await expect(
    page.getByRole("img", { name: `Preview: ${preparedImage}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share with concierge" }).click();
  await expect
    .poll(async () => page.locator(".assistant-reply").innerText())
    .toMatch(
      /caught your eye|get the details right|thoughtful choices|direction|shape|colour|illustration/i,
    );
  await page.getByRole("button", { name: `Remove ${preparedImage}` }).click();
  await expect(
    page.getByRole("img", { name: `Preview: ${preparedImage}` }),
  ).toHaveCount(0);
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("invalid"),
  });
  await expect(
    page.getByText(/Choose a JPG, PNG or WebP image of \d+ Mi?B or less/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add a link" }).click();
  await page
    .getByRole("textbox", { name: "Product or reference link" })
    .fill("https://unsupported.example/x");
  await page.getByRole("button", { name: "Resolve link" }).click();
  await expect(page.getByText(/unavailable in this demo/i)).toBeVisible();
  await page
    .getByRole("textbox", { name: "Product or reference link" })
    .fill("https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c");
  await page.getByRole("button", { name: "Resolve link" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /Supported/i }),
  ).toBeVisible();
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
  await page
    .getByRole("button", { name: /Start talking|Talk to Along/ })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".orb-wrap")).not.toHaveClass(/capturing/);
  await page.getByRole("button", { name: "Type instead" }).click();
  await say(page, "bedsheets for a warm room");
  await expect(page.locator(".assistant-reply")).toContainText(
    /bed dimensions or size/i,
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
  await expect(
    page.getByRole("region", { name: "Choose a buying priority" }),
  ).toBeVisible();
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
  await page
    .getByRole("button", { name: /Start talking|Talk to Along/ })
    .click();
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
    "a work and gym bag",
    "shape, budget USD 150",
    "compare",
    "show option 1",
    "show evidence",
    "show offers",
  ]) {
    await voiceSay(text);
    await finish();
  }
  await expect(canvasArticles(page).first()).toBeVisible();
  await voiceSay("choose faster offer");
  await expect(
    page.getByRole("article", { name: "Complete current order summary" }),
  ).toContainText(/Review the details|Ready to confirm/i);
  await finish();
  await expect(
    page.getByRole("article", { name: "Complete current order summary" }),
  ).toHaveAttribute("data-summary-status", "eligible");
  // Voice purchase approval needs trusted duplex evidence; finish via text.
  await page.getByRole("button", { name: "Type instead" }).click();
  await say(page, "review summary");
  await say(page, "Yes please");
  await expect(confirmation(page)).toContainText("Order confirmed");
});

test("switching from interrupted voice summary requires fresh text confirmation", async ({
  page,
}) => {
  await installVoiceMock(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: /Start talking|Talk to Along/ })
    .click();
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
    await page.evaluate(() =>
      (
        window as unknown as { __voice: { finish: () => void } }
      ).__voice.finish(),
    );
    await expect(page.locator(".voice-status")).toContainText("Listening");
  };
  await voiceSay("a work and gym bag");
  await voiceSay("shape, budget USD 150");
  await voiceSay("show offers");
  await voiceSay("choose faster offer");
  const summary = page.getByRole("article", {
    name: "Complete current order summary",
  });
  await expect(summary).toBeVisible();
  const initialSummaryId = await summary.getAttribute("data-summary-id");
  // Interrupt while a follow-up voice turn is speaking over the summary.
  await page.evaluate(() =>
    (
      window as unknown as { __voice: { say: (t: string) => void } }
    ).__voice.say("review summary"),
  );
  await expect(page.locator(".voice-status")).toContainText("Speaking");
  await page.getByRole("button", { name: "Stop speaking" }).click();
  await page.getByRole("button", { name: "Type instead" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your message" }),
  ).toBeVisible();
  await expect(confirmation(page)).toHaveCount(0);
  await say(page, "review summary");
  await expect(summary).toHaveAttribute("data-summary-status", "eligible");
  await expect(summary).not.toHaveAttribute(
    "data-summary-id",
    initialSummaryId!,
  );
  await say(page, "Please place the order");
  await expect(confirmation(page)).toContainText("Order confirmed");
});

test("upload loading and network failure remain visible and removable", async ({
  page,
}) => {
  await textMode(page);
  await openSettings(page);
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
  await expect(carouselChoices(page)).toHaveCount(3);
});

test("removing a reference while its accepted share is delayed clears server state", async ({
  page,
}) => {
  await textMode(page);
  await openSettings(page);
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
  await page.getByRole("button", { name: `Remove ${preparedImage}` }).click();
  release!();
  await expect(
    page.getByRole("img", { name: `Preview: ${preparedImage}` }),
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
  await openSettings(page);
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
  await page.getByRole("button", { name: `Remove ${preparedImage}` }).click();
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

test("inline review pauses voice, stops media before resuming, and preserves the conversation", async ({
  page,
  context,
}) => {
  await installVoiceMock(page);
  // Exercise the real app/controller lifecycle without depending on YouTube availability.
  // Actual YouTube playback is checked separately in personal Chrome.
  await page.route("https://www.youtube.com/embed/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Review player fixture</title><button>Play review fixture</button>",
    }),
  );
  await textMode(page);
  await say(page, "Show catalog MIC-062");
  const sessionId = await page.evaluate(() =>
    sessionStorage.getItem("along.sessionId"),
  );
  await page
    .getByRole("textbox", { name: "Your message" })
    .fill("Keep this thought");
  await page
    .getByRole("button", { name: /Start talking|Talk to Along/ })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__voice.capturing()))
    .toBe(true);
  const pagesBefore = context.pages().length;
  await page.getByRole("button", { name: "Watch review", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.locator('iframe[title="Rode Wireless Pro — Review & Audio Test"]'),
  ).toBeVisible();
  expect(context.pages()).toHaveLength(pagesBefore);
  await expect
    .poll(() => page.evaluate(() => (window as any).__voice.capturing()))
    .toBe(false);
  await expect(page.locator(".voice-status")).toContainText("Paused");
  await page
    .getByRole("button", { name: "Continue conversation", exact: true })
    .click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).__voice.capturing()))
    .toBe(true);
  expect(
    await page.evaluate(() => sessionStorage.getItem("along.sessionId")),
  ).toBe(sessionId);
  // Closing without continuing must never silently restart the microphone.
  await page.getByRole("button", { name: "Watch review", exact: true }).click();
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__voice.capturing())).toBe(
    false,
  );
  await page.getByRole("button", { name: "Type instead" }).click();
  await expect(page.getByRole("textbox", { name: "Your message" })).toHaveValue(
    "Keep this thought",
  );
  await say(page, "Focus MIC-062");
  expect(
    await page.evaluate(() => sessionStorage.getItem("along.sessionId")),
  ).toBe(sessionId);
});
