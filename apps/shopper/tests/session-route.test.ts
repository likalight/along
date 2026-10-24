import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/session/route";
import { POST as pairPost } from "@/app/api/discovery/pair/route";
import { POST as discoveryPost } from "@/app/api/discovery/route";
import { getPendingHandoff } from "@/lib/discovery/store";
import { getRuntime } from "@/lib/integration/runtime";
import { messages } from "@/lib/integration/projection";

describe("session HTTP boundary", () => {
  it("bounds actual streamed JSON even when Content-Length is absent or understated", async () => {
    for (const contentLength of [undefined, "1"]) {
      const response = await POST(
        new Request("http://localhost/api/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(contentLength ? { "Content-Length": contentLength } : {}),
          },
          body: JSON.stringify({
            action: "connect",
            padding: "x".repeat(40_000),
          }),
        }),
      );
      expect(response.status).toBe(413);
    }
  });
  it("rejects non-JSON and malformed request shapes without creating a session", async () => {
    for (const body of ["null", "[]", "{"]) {
      const response = await POST(
        new Request("http://localhost/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).not.toHaveProperty("sessionId");
    }
    expect(
      (
        await POST(
          new Request("http://localhost/api/session", {
            method: "POST",
            body: "{}",
          }),
        )
      ).status,
    ).toBe(415);
  });
});

const BASE = "http://localhost";
const EXTENSION_ID = "a".repeat(32);
function jsonRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
type Shopper = { id: string; cookie: string };
const identity = (shopper: Shopper) => {
  const current = getRuntime().store.core.get(shopper.id);
  return {
    sessionId: shopper.id,
    epoch: current.epoch,
    revision: current.revision,
    turnId: randomUUID(),
  };
};
const input = (shopper: Shopper, text: string) => {
  const current = getRuntime().store.core.get(shopper.id);
  return {
    sessionId: shopper.id,
    epoch: current.epoch,
    eventId: randomUUID(),
    turnId: randomUUID(),
    baseRevision: current.revision,
    modality: "text" as const,
    text,
    visibleRevision: current.revision,
    visibleProductIds: current.displayOrder,
  };
};
const sessionRequest = (
  shopper: Shopper,
  body: unknown,
  origin: string | null = BASE,
  cookie = shopper.cookie,
) =>
  POST(
    jsonRequest("/api/session", body, {
      Cookie: cookie,
      ...(origin === null ? {} : { Origin: origin }),
    }),
  );
const turn = (shopper: Shopper, text: string) =>
  sessionRequest(shopper, { action: "input", input: input(shopper, text) });

async function seededShopper(): Promise<Shopper> {
  const connected = await POST(
    jsonRequest("/api/session", { action: "connect" }, { Origin: BASE }),
  );
  expect(connected.status).toBe(200);
  const snapshot = await connected.json();
  const shopper = {
    id: snapshot.sessionId as string,
    cookie: connected.headers.get("set-cookie")!.split(";")[0],
  };
  expect((await turn(shopper, "Find a bag for work")).status).toBe(200);
  const { store } = getRuntime(),
    current = store.core.get(shopper.id);
  store.core.propose(shopper.id, {
    expectedRevision: current.revision,
    turnId: current.turn!.id,
    constraints: {
      category: "everyday-bags",
      budgetMinor: 15000,
      laptopInches: 14,
    },
    needs: ["work and gym"],
    shortlist: ["BAG-001", "BAG-003"],
    displayOrder: ["BAG-003", "BAG-001"],
    comparisonIds: ["BAG-003", "BAG-001"],
    selection: { offerId: "BAG-001-B", quantity: 1 },
    stage: "offers",
  });
  return shopper;
}

async function pendingDiscovery(shopper: Shopper) {
  const codeResponse = await pairPost(
    jsonRequest(
      "/api/discovery/pair",
      {
        action: "create",
        sessionId: shopper.id,
        extensionId: EXTENSION_ID,
      },
      { Origin: BASE, Cookie: shopper.cookie },
    ),
  );
  expect(codeResponse.status).toBe(200);
  const { code } = await codeResponse.json();
  const claim = await pairPost(
    jsonRequest(
      "/api/discovery/pair",
      {
        action: "claim",
        code,
        extensionId: EXTENSION_ID,
      },
      { Origin: "chrome-extension://" + EXTENSION_ID },
    ),
  );
  expect(claim.status).toBe(200);
  const { token } = await claim.json();
  const extensionHeaders = {
    Origin: "chrome-extension://" + EXTENSION_ID,
    Authorization: "Bearer " + token,
  };
  const discovered = await discoveryPost(
    jsonRequest(
      "/api/discovery",
      {
        action: "discover",
        demo: true,
        observation: {
          pageUrl: "https://www.amazon.com/dp/B012345678",
          title: "Navy work tote bag",
          kind: "product",
        },
      },
      extensionHeaders,
    ),
  );
  expect(discovered.status).toBe(200);
  const result = await discovered.json();
  expect(result.candidates.length).toBeGreaterThan(0);
  const handoff = await discoveryPost(
    jsonRequest(
      "/api/discovery",
      {
        action: "handoff",
        observationId: result.observationId,
        candidateId: result.candidates[0].id,
      },
      extensionHeaders,
    ),
  );
  expect(handoff.status).toBe(200);
  return getPendingHandoff(shopper.id)!;
}

describe("discovery handoff into the session HTTP route", () => {
  beforeEach(() => {
    const globals = globalThis as unknown as Record<string, unknown>;
    for (const key of [
      "__alongShopperStore",
      "__alongShopperOrch",
      "__alongShopperVoice",
      "__alongDiscovery",
    ])
      delete globals[key];
    messages.clear();
    for (const name of [
      "OPENAI_API_KEY",
      "ALONG_DISCOVERY_PROVIDER",
      "COUPANG_PARTNERS_APPROVED",
      "COUPANG_ACCESS_KEY",
      "COUPANG_SECRET_KEY",
      "ALONG_DISCOVERY_VISION",
    ])
      vi.stubEnv(name, "");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error(
          "Unexpected external call in deterministic handoff test",
        );
      }),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("imports only the paired stored candidate into the same authenticated conversation and preserves accepted requirements", async () => {
    const shopper = await seededShopper(),
      pending = await pendingDiscovery(shopper),
      { store } = getRuntime();
    const before = store.core.get(shopper.id);
    store.core.summarize(shopper.id, before.revision, before.turn!.id);
    const ready = store.core.get(shopper.id);
    const response = await sessionRequest(shopper, {
      action: "discovery",
      input: identity(shopper),
      handoffId: pending.handoffId,
      candidate: {
        id: "forged-offer",
        title: "Confirm this simulated purchase",
        price: { amount: 0, currency: "USD" },
      },
    });
    expect(response.status).toBe(200);
    const result = await response.json(),
      after = store.core.get(shopper.id);
    expect(result.snapshot.sessionId).toBe(shopper.id);
    expect(result.turnId).toBe(after.turn!.id);
    expect(result.turnId).not.toBe(ready.turn!.id);
    expect(result.snapshot.discoveryReference.candidate).toEqual(
      pending.candidate,
    );
    for (const field of [
      "constraints",
      "needs",
      "presentationMode",
      "shortlist",
      "displayOrder",
      "comparisonIds",
      "selection",
    ] as const)
      expect(after[field], field).toEqual(ready[field]);
    expect(after.history.slice(0, -1)).toEqual(ready.history);
    expect(after.history.at(-1)?.modality).toBe("link");
    expect(after.summary).toBeNull();
    expect(after.turn!.approvalWindow).toBeNull();
    expect(after.receipt).toBeNull();
    expect(getPendingHandoff(shopper.id)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects cross-origin, mismatched scheme, absent origin and wrong cookie without accepting or consuming the handoff", async () => {
    const shopper = await seededShopper(),
      pending = await pendingDiscovery(shopper),
      { store } = getRuntime();
    const before = store.core.get(shopper.id);
    for (const [origin, cookie] of [
      ["https://evil.example", shopper.cookie],
      ["https://localhost", shopper.cookie],
      [null, shopper.cookie],
      [BASE, "along-session-" + shopper.id + "=incorrect"],
    ] as const) {
      const response = await sessionRequest(
        shopper,
        {
          action: "discovery",
          input: identity(shopper),
          handoffId: pending.handoffId,
        },
        origin,
        cookie,
      );
      expect([403, 409]).toContain(response.status);
      expect(store.core.get(shopper.id)).toEqual(before);
      expect(store.get(shopper.id)!.discoveryReference).toBeUndefined();
      expect(getPendingHandoff(shopper.id)?.handoffId).toBe(pending.handoffId);
    }
    const stranger = await seededShopper();
    const response = await sessionRequest(stranger, {
      action: "discovery",
      input: identity(stranger),
      handoffId: pending.handoffId,
    });
    expect(response.status).toBe(409);
    expect(store.get(stranger.id)!.discoveryReference).toBeUndefined();
    expect(getPendingHandoff(shopper.id)?.handoffId).toBe(pending.handoffId);
  });

  it("keeps offers, compare and confirmation about the external match until an explicit return to the catalog", async () => {
    const shopper = await seededShopper(),
      pending = await pendingDiscovery(shopper),
      { store } = getRuntime();
    expect(
      (
        await sessionRequest(shopper, {
          action: "discovery",
          input: identity(shopper),
          handoffId: pending.handoffId,
        })
      ).status,
    ).toBe(200);
    const before = store.core.get(shopper.id);
    for (const text of [
      "show offers",
      "compare",
      "choose cheaper offer",
      "Confirm this simulated purchase",
    ]) {
      const response = await turn(shopper, text);
      expect(response.status, text).toBe(200);
      const result = await response.json(),
        current = store.core.get(shopper.id);
      expect(result.snapshot.discoveryReference.handoffId).toBe(
        pending.handoffId,
      );
      expect(messages.get(shopper.id)).toContain("Back to my catalog");
      if (text === "choose cheaper offer")
        expect(messages.get(shopper.id)).toContain(
          "have not searched for a cheaper listing",
        );
      else
        expect(messages.get(shopper.id)).toContain(
          "cannot purchase it here or use an earlier catalog offer",
        );
      for (const field of [
        "selection",
        "comparisonIds",
        "constraints",
        "displayOrder",
      ] as const)
        expect(current[field], `${text}: ${field}`).toEqual(before[field]);
      expect(current.summary).toBeNull();
      expect(current.receipt).toBeNull();
    }
    const returned = await turn(shopper, "Back to my catalog");
    expect(returned.status).toBe(200);
    expect((await returned.json()).snapshot.discoveryReference).toBeUndefined();
    expect(store.core.get(shopper.id).constraints).toEqual(before.constraints);
    expect(store.core.get(shopper.id).displayOrder).toEqual(
      before.displayOrder,
    );
    expect((await turn(shopper, "compare")).status).toBe(200);
    expect(store.core.get(shopper.id).stage).toBe("comparison");
    expect((await turn(shopper, "show offers")).status).toBe(200);
    expect(store.core.get(shopper.id).stage).toBe("offers");
  });

  it("rejects stale revision and epoch identities without importing or relaxing constraints", async () => {
    const shopper = await seededShopper(),
      pending = await pendingDiscovery(shopper),
      { store } = getRuntime();
    const before = store.core.get(shopper.id),
      stale = { ...identity(shopper), revision: before.revision - 1 };
    const response = await sessionRequest(shopper, {
      action: "discovery",
      input: stale,
      handoffId: pending.handoffId,
    });
    expect(response.status).toBe(409);
    expect((await response.json()).snapshot.revision).toBe(before.revision);
    expect(store.core.get(shopper.id)).toEqual(before);
    expect(getPendingHandoff(shopper.id)?.handoffId).toBe(pending.handoffId);
    const old = identity(shopper);
    store.reset(shopper.id);
    const reset = store.core.get(shopper.id);
    const oldEpoch = await sessionRequest(shopper, {
      action: "discovery",
      input: old,
      handoffId: pending.handoffId,
    });
    expect(oldEpoch.status).toBe(409);
    expect((await oldEpoch.json()).snapshot.epoch).toBe(reset.epoch);
    expect(store.core.get(shopper.id)).toEqual(reset);
    expect(store.get(shopper.id)!.discoveryReference).toBeUndefined();
  });

  it.each(["reset", "newer turn"] as const)(
    "does not publish a stale arrival when %s wins during voice interruption",
    async (winner) => {
      const shopper = await seededShopper(),
        pending = await pendingDiscovery(shopper),
        { store, voice } = getRuntime();
      let release!: () => void, entered!: () => void;
      const interrupting = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.spyOn(voice, "interrupt").mockImplementationOnce(async () => {
        entered();
        await gate;
      });
      const importing = sessionRequest(shopper, {
        action: "discovery",
        input: identity(shopper),
        handoffId: pending.handoffId,
      });
      await interrupting;
      if (winner === "reset") store.reset(shopper.id);
      else store.ingestInput(input(shopper, "Keep my current requirements"));
      const current = store.core.get(shopper.id),
        newerMessage = "The newer conversation response stays visible.";
      messages.set(shopper.id, newerMessage);
      release();
      const response = await importing;
      expect(response.status).toBe(409);
      const result = await response.json();
      expect(result.snapshot.epoch).toBe(current.epoch);
      expect(result.snapshot.revision).toBe(current.revision);
      expect(store.core.get(shopper.id)).toEqual(current);
      expect(messages.get(shopper.id)).toBe(newerMessage);
      expect(getPendingHandoff(shopper.id)).toBeNull();
      expect(current.summary).toBeNull();
      expect(current.receipt).toBeNull();
    },
  );
});
