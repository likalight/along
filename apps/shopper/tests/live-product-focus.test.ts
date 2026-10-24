import { describe, expect, it, vi } from "vitest";
import { SessionController } from "@/lib/session/controller";
import { initialSession } from "@/lib/session/fixtures";
import {
  LiveProductFocus,
  mentionedProduct,
  requestsChromeReview,
} from "@/lib/session/live-product-focus";
import { products } from "@/lib/canvas/fixtures";
import type { Product } from "@/lib/canvas/contracts";
import type { Session, SessionTransport } from "@/lib/session/contract";
import type { SpeechAdapter, SpeechCallbacks } from "@/lib/voice/adapter";

const visibleProducts = ["MIC-001", "MIC-003", "MIC-015"].map((id) =>
  products.find((product) => product.id === id)!,
);
const shortlist = (items = visibleProducts): Session => ({
  ...initialSession("live-focus"),
  revision: 2,
  view: "shortlist",
  displayOrder: items.map((product) => product.id),
  shortlistIds: items.map((product) => product.id),
  focusedProductId: items[0].id,
  catalog: { products: items, offers: [], evidence: [] },
});

describe("live product identity matching", () => {
  it("follows the latest complete visible name, including streamed model fragments", () => {
    const focus = new LiveProductFocus();
    const snapshot = shortlist();
    expect(
      focus.accept("The Apple EarPods travel well. Logitech H3", snapshot),
    ).toBe("MIC-001");
    expect(
      focus.accept("The Apple EarPods travel well. Logitech H390", snapshot),
    ).toBe("MIC-003");
    expect(
      focus.accept(
        "The Apple EarPods travel well. Logitech H390 is wired; Shure MV6 Gen 2 frees your ears.",
        snapshot,
      ),
    ).toBe("MIC-015");
    expect(mentionedProduct("Logitech H 390 is wired", snapshot)).toBe(
      "MIC-003",
    );
  });

  it("uses explicit option references without inferring a product from pronouns or brands", () => {
    const snapshot = shortlist();
    expect(mentionedProduct("Option two has the closer boom", snapshot)).toBe(
      "MIC-003",
    );
    expect(
      mentionedProduct("The third option keeps your ears free", snapshot),
    ).toBe("MIC-015");
    expect(
      mentionedProduct("I prefer Logitech, this one is better", snapshot),
    ).toBeNull();
    expect(mentionedProduct("Option four", snapshot)).toBeNull();
    expect(mentionedProduct("Jabra Evolve2 65 Flex", snapshot)).toBeNull();
  });

  it("requires enough of a shared name to identify the visible variant", () => {
    const first: Product = {
      ...visibleProducts[0],
      model: "EarPods (USB-C)",
      title: "Apple EarPods (USB-C)",
    };
    const second: Product = {
      ...first,
      id: "other-earpods",
      model: "EarPods (3.5mm)",
      title: "Apple EarPods (3.5mm)",
    };
    const snapshot = shortlist([first, second]);
    expect(mentionedProduct("The Apple EarPods", snapshot)).toBeNull();
    expect(
      mentionedProduct("The Apple EarPods USB C is an option", snapshot),
    ).toBe(first.id);
    expect(mentionedProduct("The EarPods 3.5mm is the other", snapshot)).toBe(
      second.id,
    );
  });

  it("waits for shared model prefixes and prefers a complete longer name", () => {
    const first: Product = {
      ...visibleProducts[0],
      brand: "RØDE",
      model: "Wireless Go",
      title: "RØDE Wireless Go",
    };
    const second: Product = {
      ...first,
      id: "go-ii",
      model: "Wireless Go II",
      title: "RØDE Wireless Go II",
    };
    const snapshot = shortlist([first, second]);
    expect(mentionedProduct("The Rode Wireless Go", snapshot)).toBeNull();
    expect(mentionedProduct("The Rode Wireless Go I", snapshot)).toBeNull();
    expect(mentionedProduct("The Rode Wireless Go II", snapshot)).toBe(
      second.id,
    );
    expect(
      mentionedProduct("The Rode Wireless Go is the original", snapshot),
    ).toBe(first.id);
  });

  it("does not replay old names after the accepted canvas or conversational floor changes", () => {
    const focus = new LiveProductFocus();
    const snapshot = shortlist();
    expect(focus.accept("Logitech H390", snapshot)).toBe("MIC-003");
    focus.clear();
    expect(
      focus.accept("Logitech H390 has a boom", { ...snapshot, revision: 3 }),
    ).toBeNull();
    expect(
      focus.accept("Logitech H390 has a boom. Option three", snapshot),
    ).toBe("MIC-015");
    focus.clear(true);
    expect(focus.accept("Late Apple EarPods output", snapshot)).toBeNull();
    focus.clear();
    expect(focus.accept("Now the Shure MV6 Gen 2", snapshot)).toBe("MIC-015");
  });

  it("keeps the stale-caption boundary when a long transcript buffer rolls forward", () => {
    const focus = new LiveProductFocus();
    const snapshot = shortlist();
    const previous = `Earlier context ${"Long explanation. ".repeat(150)} Logitech H390`;
    focus.accept(previous, snapshot);
    focus.clear();
    const rolling = previous.slice(100) + " still has a close boom";
    expect(focus.accept(rolling, snapshot)).toBeNull();
    expect(focus.accept(rolling + ". Option three", snapshot)).toBe("MIC-015");
  });
});

async function liveHarness() {
  const snapshot = shortlist();
  let callbacks!: SpeechCallbacks;
  const speech: SpeechAdapter = {
    fullDuplex: true,
    start: vi.fn(async (value) => {
      callbacks = value;
      value.capture(true);
    }),
    stop: vi.fn(),
    cancel: vi.fn(),
    dispose: vi.fn(),
    speak: vi.fn(),
  };
  const transport: SessionTransport = {
    connect: vi.fn(async () => snapshot),
    mode: vi.fn(async () => snapshot),
    cancel: vi.fn(async () => snapshot),
    lifecycle: vi.fn(async () => snapshot),
    send: vi.fn(),
  };
  const controller = new SessionController(transport, speech);
  await controller.connect();
  await controller.chooseMode("voice");
  return { controller, callbacks, snapshot, transport };
}

describe("live carousel presentation focus", () => {
  it("moves with audible captions without changing accepted focus, revision, or purchases", async () => {
    const h = await liveHarness();
    h.callbacks.caption?.("assistant", "Logitech H390");
    expect(h.controller.getSnapshot().narrationProductId).toBeNull();
    h.callbacks.speaking?.(true);
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-003");
    h.callbacks.caption?.(
      "assistant",
      "Logitech H390 is wired. The Shure MV6 Gen 2",
    );
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-015");
    h.callbacks.speaking?.(false);
    expect(h.controller.getSnapshot().status).toBe("listening");
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-015");
    h.callbacks.speaking?.(true);
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-015");
    expect(h.controller.getSnapshot().snapshot).toBe(h.snapshot);
    expect(h.snapshot.focusedProductId).toBe("MIC-001");
    expect(h.snapshot.revision).toBe(2);
    expect(h.snapshot.selectedOfferId).toBeNull();
    expect(h.transport.send).not.toHaveBeenCalled();
    h.controller.dispose();
  });

  it("clears immediately on barge-in and user speech; ignores interrupted tail captions", async () => {
    const h = await liveHarness();
    h.callbacks.speaking?.(true);
    h.callbacks.caption?.("assistant", "Logitech H390");
    h.callbacks.bargeIn();
    expect(h.controller.getSnapshot().narrationProductId).toBeNull();
    h.callbacks.speaking?.(true);
    h.callbacks.caption?.("assistant", "Logitech H390 or the Shure MV6 Gen 2");
    expect(h.controller.getSnapshot().narrationProductId).toBeNull();
    h.callbacks.caption?.("user", "What about the second option?");
    // Clear the interrupted narration, then honor the shopper's visual request.
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-003");
    h.callbacks.caption?.("assistant", "Option two is the Logitech H390");
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-003");
    h.controller.dispose();
  });

  it("rejects stale canvas revisions and never reinterprets old option numbers after reordering", async () => {
    const h = await liveHarness();
    h.callbacks.speaking?.(true);
    h.callbacks.caption?.("assistant", "Option two is a good fit");
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-003");
    const next = {
      ...h.snapshot,
      revision: 3,
      displayOrder: [...h.snapshot.displayOrder].reverse(),
    };
    h.callbacks.backend?.({ pending: false, snapshot: next });
    expect(h.controller.getSnapshot().narrationProductId).toBeNull();
    h.callbacks.caption?.(
      "assistant",
      "Option two is a good fit for desk calls",
    );
    expect(h.controller.getSnapshot().narrationProductId).toBeNull();
    h.callbacks.backend?.({ pending: false, snapshot: h.snapshot });
    expect(h.controller.getSnapshot().snapshot).toBe(next);
    h.callbacks.caption?.(
      "assistant",
      "Option two is a good fit for desk calls. Option one is Shure MV6 Gen 2",
    );
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-015");
    h.controller.dispose();
  });

  it("refocuses the first fresh reply after a clean playback boundary without a user transcript", async () => {
    const h = await liveHarness();
    h.callbacks.speaking?.(true);
    h.callbacks.caption?.("assistant", "Logitech H390");
    h.callbacks.bargeIn();
    h.callbacks.caption?.("assistant", "Logitech H390 is still old output");
    expect(h.controller.getSnapshot().narrationProductId).toBeNull();

    // The adapter signals the guarded output boundary before releasing the
    // first fresh caption, even when transcription missed the shopper's speech.
    h.callbacks.playbackResumed?.();
    h.callbacks.caption?.("assistant", "Logitech H390");
    h.callbacks.speaking?.(true);
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-003");
    expect(h.transport.send).not.toHaveBeenCalled();
    h.controller.dispose();
  });

  it("ignores captions from a superseded microphone session", async () => {
    const h = await liveHarness();
    await h.controller.chooseMode("text");
    h.callbacks.playbackResumed?.();
    h.callbacks.speaking?.(true);
    h.callbacks.caption?.("assistant", "Shure MV6 Gen 2");
    expect(h.controller.getSnapshot().narrationProductId).toBeNull();
    expect(h.controller.getSnapshot().mode).toBe("text");
    h.controller.dispose();
  });
});

describe("presentation command regressions", () => {
  it("keeps spoken focus through unrelated accepted revisions", async () => {
    const h = await liveHarness();
    h.callbacks.speaking?.(true);
    h.callbacks.caption?.("assistant", "The Logitech H390 is wired");
    h.callbacks.backend?.({
      pending: false,
      snapshot: { ...h.snapshot, revision: 3 },
    });
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-003");
    h.controller.dispose();
  });
  it("matches spoken base models without configuration suffixes, but not ambiguous variants", () => {
    const micro = {
      ...visibleProducts[0],
      id: "MIC-063",
      brand: "RØDE",
      model: "Wireless Micro, USB-C, Black",
      title: "RØDE Wireless Micro, USB-C, Black",
    };
    expect(
      mentionedProduct(
        "The Rode Wireless Micro is compact",
        shortlist([micro]),
      ),
    ).toBe("MIC-063");
    const other = {
      ...micro,
      id: "another",
      model: "Wireless Micro, Lightning, Black",
      title: "RØDE Wireless Micro, Lightning, Black",
    };
    expect(
      mentionedProduct("The Rode Wireless Micro", shortlist([micro, other])),
    ).toBeNull();
  });
  it("moves a spoken next command once while fragments arrive without changing the order", async () => {
    const h = await liveHarness();
    h.callbacks.caption?.("user", "Next");
    h.callbacks.caption?.("user", "Next product");
    expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-003");
    expect(h.controller.getSnapshot().snapshot).toBe(h.snapshot);
    expect(h.transport.send).not.toHaveBeenCalled();
    h.controller.dispose();
  });
  it("only recognizes direct Chrome review commands, not negations or quoted discussion", () => {
    expect(requestsChromeReview("Take me to the Chrome tab")).toBe(true);
    expect(requestsChromeReview("Please open YouTube")).toBe(true);
    expect(requestsChromeReview("Don't take me to Chrome")).toBe(false);
    expect(
      requestsChromeReview("What happens if I say take me to Chrome?"),
    ).toBe(false);
  });
});

it("reconciles speech that names a product before the first shortlist reaches the browser", async () => {
  const h = await liveHarness();
  h.callbacks.backend?.({
    pending: true,
    snapshot: {
      ...h.snapshot,
      revision: 3,
      displayOrder: [],
      focusedProductId: null,
    },
  });
  h.callbacks.speaking?.(true);
  h.callbacks.caption?.("assistant", "The Logitech H390 suits you");
  expect(h.controller.getSnapshot().narrationProductId).toBeNull();
  h.callbacks.backend?.({
    pending: false,
    snapshot: { ...h.snapshot, revision: 4 },
  });
  expect(h.controller.getSnapshot().narrationProductId).toBe("MIC-003");
  h.controller.dispose();
});

it("Chrome voice navigation targets the narrated product once, never checkout", async () => {
  const h = await liveHarness();
  h.callbacks.speaking?.(true);
  h.callbacks.caption?.("assistant", "The Logitech H390 is wired");
  h.callbacks.bargeIn();
  h.callbacks.caption?.("user", "Take me to the Chrome tab");
  const request = h.controller.getSnapshot().voiceReviewRequest;
  expect(request?.productId).toBe("MIC-003");
  h.callbacks.caption?.("user", "Take me to the Chrome tab.");
  expect(h.controller.getSnapshot().voiceReviewRequest).toBe(request);
  expect(h.controller.getSnapshot().snapshot?.selectedOfferId).toBeNull();
  expect(h.transport.send).not.toHaveBeenCalled();
  h.controller.dispose();
});
