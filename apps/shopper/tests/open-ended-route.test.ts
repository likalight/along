import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/session/route";
import { getRuntime } from "@/lib/integration/runtime";

function resetRuntime() {
  const runtime = globalThis as unknown as Record<string, unknown>;
  delete runtime.__alongShopperStore;
  delete runtime.__alongShopperOrch;
  delete runtime.__alongShopperVoice;
}

async function session() {
  let cookie = "";
  let snapshot: any;
  async function request(body: unknown) {
    const response = await POST(
      new Request("http://localhost/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
    );
    const nextCookie = response.headers.get("set-cookie");
    if (nextCookie) cookie = nextCookie.split(";")[0];
    const data = await response.json();
    if (data.sessionId && !data.snapshot) snapshot = data;
    if (data.snapshot) snapshot = data.snapshot;
    return { status: response.status, data };
  }
  const connected = await request({ action: "connect" });
  snapshot = connected.data;
  const identity = () => ({
    sessionId: snapshot.sessionId,
    epoch: snapshot.epoch,
    turnId: crypto.randomUUID(),
    revision: snapshot.revision,
  });
  const input = (text: string) => ({
    ...identity(),
    eventId: crypto.randomUUID(),
    baseRevision: snapshot.revision,
    modality: "text",
    text,
    visibleRevision: snapshot.revision,
    visibleProductIds: snapshot.displayOrder,
  });
  async function send(text: string) {
    const result = await request({ action: "input", input: input(text) });
    if (result.data.snapshot) snapshot = result.data.snapshot;
    return result;
  }
  return { request, input, send, identity, snapshot: () => snapshot };
}

const answer = (text: string) =>
  new Response(
    JSON.stringify({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                heading: "Roomier bags for your day",
                message: text,
                segments: [{ text, productId: null }],
              }),
            },
          ],
        },
      ],
    }),
    { status: 200 },
  );

describe("open-ended agent HTTP integration", () => {
  beforeEach(() => {
    resetRuntime();
    vi.stubEnv("ALONG_AGENT_MODE", "live");
    vi.stubEnv("ALONG_AGENT_MODEL", "");
    vi.stubEnv("ALONG_AGENT_REASONING_EFFORT", "");
    vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  });
  afterEach(() => {
    resetRuntime();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("runs an explicitly selected development fixture journey without a provider", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALONG_AGENT_MODE", "fixture");
    vi.stubEnv("OPENAI_API_KEY", "");
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const client = await session();
    const result = await client.send("a work and gym bag");
    expect(result.status).toBe(200);
    const choices = await client.send("shape, budget USD 150");
    expect(choices.status).toBe(200);
    expect(choices.data.snapshot.category).toBe("bags");
    expect(choices.data.snapshot.displayOrder.length).toBeGreaterThan(0);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(["development", "production"])(
    "keeps %s live without an explicit test fixture mode",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      vi.stubEnv(
        "ALONG_AGENT_MODE",
        environment === "production" ? "fixture" : "",
      );
      const provider = vi.fn(async () => answer("The live model answered."));
      vi.stubGlobal("fetch", provider);
      const client = await session();
      const result = await client.send("a work and gym bag");
      expect(result.status).toBe(200);
      expect(result.data.snapshot.message).toBe("The live model answered.");
      expect(provider).toHaveBeenCalledOnce();
    },
  );

  it("shows direction cards first, then resolves a numbered direction into product choices", async () => {
    const call = (name: string, args: unknown) =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "function_call",
              name,
              arguments: JSON.stringify(args),
              call_id: crypto.randomUUID(),
            },
          ],
        }),
        { status: 200 },
      );
    let providerRequests = 0;
    let clipId = "";
    const provider = vi.fn(async (_url: unknown, init: RequestInit) => {
      providerRequests++;
      const body = JSON.parse(String(init.body));
      if (providerRequests === 1)
        return call("show_solution_types", {
          question: "Will you stay at your desk, or move around?",
        });
      if (providerRequests === 2)
        return answer(
          "A headset stays near your mouth; a lavalier moves with you; a desk mic needs close placement. Which suits your day?",
        );
      if (providerRequests === 3) {
        expect(JSON.stringify(body.input)).toContain("Show me the second one");
        expect(JSON.stringify(body.input)).toContain("solution_types");
        return call("choose_solution_type", { solutionType: "clip_on" });
      }
      if (providerRequests === 4)
        return call("search_catalog", { category: "audio", query: "lavalier" });
      if (providerRequests === 5)
        return call("shortlist", {
          entries: [
            {
              productId: clipId,
              fitReason: "A portable clip-on microphone",
              compromise: "Check its receiver connection",
            },
          ],
        });
      return answer(
        "Here is a clip-on microphone. Check that the receiver works with your device.",
      );
    });
    vi.stubGlobal("fetch", provider);
    const client = await session();
    clipId = getRuntime()
      .store.listProducts("audio")
      .find((product) => product.solutionType === "clip_on")!.id;
    const directions = await client.send(
      "My calls sound unclear in a noisy room. Help me find a mic.",
    );
    expect(directions.status).toBe(200);
    expect(directions.data.snapshot.view).toBe("solution_types");
    expect(directions.data.snapshot.category).toBe("audio");
    expect(directions.data.snapshot.displayOrder).toEqual([]);
    expect(providerRequests).toBe(2);

    const chosen = await client.send("Show me the second one");
    expect(chosen.status).toBe(200);
    expect(chosen.data.snapshot.view).toBe("shortlist");
    expect(chosen.data.snapshot.displayOrder).toEqual([clipId]);
    expect(chosen.data.snapshot.canvas.solution).toBe("clip");
    expect(chosen.data.snapshot.buyingPriority).toBeNull();
    expect(providerRequests).toBe(6);
  });

  it("routes routine conversation to Luna low while exact purchase confirmation bypasses the model", async () => {
    const provider = vi
      .fn()
      .mockImplementation(async () => answer("Let's find a useful bag."));
    vi.stubGlobal("fetch", provider);
    const client = await session();
    const conversation = await client.send(
      "Help me choose something for university",
    );
    expect(conversation.status).toBe(200);
    expect(conversation.data.snapshot.message).toBe("Let's find a useful bag.");
    expect(conversation.data.snapshot.narrationSegments).toEqual([
      { text: "Let's find a useful bag.", productId: null },
    ]);
    expect(conversation.data.snapshot.heading).toBe(
      "Roomier bags for your day",
    );
    expect(conversation.data.snapshot.canvas.heading).toBe(
      "Roomier bags for your day",
    );
    expect(JSON.parse(provider.mock.calls[0][1].body).model).toBe("gpt-6-luna");
    expect(JSON.parse(provider.mock.calls[0][1].body).reasoning.effort).toBe(
      "low",
    );
    const summary = await client.send("Select offer BAG-001-B");
    expect(summary.status, summary.data.error).toBe(200);
    expect(summary.data.snapshot.summary).toBeTruthy();
    const s = summary.data.snapshot;
    const m = getRuntime().store.core.get(s.sessionId).summary!;
    const presented = await client.request({
      action: "presented",
      input: { ...client.identity(), turnId: m.responseTurnId },
      summaryId: m.id,
      textHash: m.textHash,
    });
    expect(presented.status).toBe(200);
    // Refresh the client revision after the server's presentation acknowledgement.
    const refreshed = await client.send("Confirm this simulated purchase");
    expect(refreshed.status, refreshed.data.error).toBe(200);
    expect(refreshed.data.snapshot.view).toBe("receipt");
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("answers a follow-up about a selected offer without replacing it with the old purchase summary", async () => {
    const provider = vi
      .fn()
      .mockImplementation(async () =>
        answer("The larger bag gives you more space for gym clothes."),
      );
    vi.stubGlobal("fetch", provider);
    const client = await session();
    const selected = await client.send("Select offer BAG-001-B");
    expect(selected.status).toBe(200);
    const summaryId = selected.data.snapshot.summaryId;
    const summary = getRuntime().store.core.get(
      client.snapshot().sessionId,
    ).summary!;
    await client.request({
      action: "presented",
      input: { ...client.identity(), turnId: summary.responseTurnId },
      summaryId: summary.id,
      textHash: summary.textHash,
    });
    const response = await client.send("Why does this bag suit me?");
    expect(response.status).toBe(200);
    expect(response.data.snapshot.message).toBe(
      "The larger bag gives you more space for gym clothes.",
    );
    expect(response.data.snapshot.summaryId).toBe(summaryId);
    expect(response.data.snapshot.receipt).toBeFalsy();
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("rejects confirmation before a summary is presented without consulting the model", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const client = await session();
    const result = await client.send("Confirm this simulated purchase");
    expect(result.status).toBe(409);
    expect(result.data.snapshot.receipt).toBeFalsy();
    expect(provider).not.toHaveBeenCalled();
  });

  it("exposes only authenticated current-turn progress during pending work and final heading after completion", async () => {
    let release!: (response: Response) => void;
    const provider = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal("fetch", provider);
    const client = await session();
    const input = client.input("Find me a cheaper bag");
    const pending = client.request({ action: "input", input });
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    const progress = await client.request({ action: "activity", input });
    expect(progress.data.activity).toMatchObject({
      turnId: input.turnId,
      phase: "working",
      label: "Considering your request…",
    });
    expect(Object.keys(progress.data.activity).sort()).toEqual([
      "heading",
      "label",
      "phase",
      "turnId",
    ]);
    const stale = await client.request({
      action: "activity",
      input: { ...input, turnId: "old-turn" },
    });
    expect(stale.data.activity).toBeNull();
    const unauthenticated = await POST(
      new Request("http://localhost/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activity", input }),
      }),
    );
    expect(unauthenticated.status).toBe(403);
    const staleEpoch = await client.request({
      action: "activity",
      input: { ...input, epoch: input.epoch + 1 },
    });
    expect(staleEpoch.status).toBe(409);
    release(answer("Here are your options."));
    const result = await pending;
    expect(result.status).toBe(200);
    const completed = await client.request({ action: "activity", input });
    expect(completed.data.activity).toMatchObject({
      phase: "done",
      heading: result.data.snapshot.heading,
    });
  });

  it("aborts pending provider work when the current turn is cancelled", async () => {
    let providerSignal: AbortSignal | undefined;
    const provider = vi.fn().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          providerSignal = init.signal;
          providerSignal!.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", provider);
    const client = await session();
    const input = client.input("Help me plan what to buy for university");
    const pending = client.request({ action: "input", input });
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    const cancelled = await client.request({ action: "cancel", input });
    expect(cancelled.status).toBe(200);
    expect(providerSignal?.aborted).toBe(true);
    const result = await pending;
    expect(result.data.snapshot.receipt).toBeFalsy();
    expect(getRuntime().orch.turnsFor(input.sessionId).active).toBeNull();
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("returns recoverable state without exposing provider error bodies or creating a purchase", async () => {
    const provider = vi
      .fn()
      .mockResolvedValue(
        new Response("private provider account diagnostic", { status: 503 }),
      );
    vi.stubGlobal("fetch", provider);
    const client = await session();
    const result = await client.send("I need help choosing a bag");
    expect(result.status).toBe(409);
    expect(JSON.stringify(result.data)).not.toContain(
      "private provider account diagnostic",
    );
    expect(JSON.stringify(result.data)).not.toContain("test-key-not-real");
    expect(result.data.snapshot.receipt).toBeFalsy();
    expect(result.data.snapshot.sessionId).toBe(client.snapshot().sessionId);
    expect(
      getRuntime().orch.turnsFor(client.snapshot().sessionId).active,
    ).toBeNull();
    provider.mockImplementation(async () =>
      answer("We can try again. What will you carry?"),
    );
    const retry = await client.send("Let's try again");
    expect(retry.status).toBe(200);
    expect(retry.data.snapshot.message).toContain("We can try again");
  });
});
