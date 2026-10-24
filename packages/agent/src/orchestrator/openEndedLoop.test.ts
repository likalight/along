import assert from "node:assert/strict";
import { test } from "node:test";
import type { InputEvent } from "@coupang/contract";
import { FixtureSessionStore } from "../session/FixtureSessionStore.js";
import { SessionThread } from "../thread/SessionThread.js";
import { openEndedLoop } from "./openEndedLoop.js";

function setup() {
  const store = new FixtureSessionStore();
  const snap = store.create();
  const input: InputEvent = {
    sessionId: snap.sessionId,
    epoch: snap.epoch,
    baseRevision: snap.revision,
    eventId: "event",
    turnId: "turn",
    modality: "text",
    text: "Capacity matters, please find a roomy bag",
    visibleRevision: snap.revision,
    visibleProductIds: [],
  };
  const thread = new SessionThread(snap);
  thread.append({
    type: "assistant_transcript",
    data: { turnId: "earlier", text: "What matters most?" },
  });
  thread.append({ type: "user_input", data: input });
  return { store, input, thread, cancel: new AbortController().signal };
}
const answer = (text: string) => ({
  output: [
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: JSON.stringify({ heading: "Room for your day", message: text }),
        },
      ],
    },
  ],
});
const toolCall = (name: string, args: unknown, callId = name) => ({
  output: [{
    type: "function_call",
    name,
    arguments: JSON.stringify(args),
    call_id: callId,
  }],
});
const mockFetch =
  (
    handler: (
      body: any,
      signal?: AbortSignal | null,
    ) => unknown | Promise<unknown>,
  ): typeof fetch =>
  async (_url, init) =>
    new Response(
      JSON.stringify(
        await handler(JSON.parse(String(init?.body)), init?.signal),
      ),
      { status: 200 },
    );

test("model sees conversation and state and may answer without forced workflow", async () => {
  const result = await openEndedLoop({
    ...setup(),
    config: {
      apiKey: "test",
      model: "gpt-6-astra",
      fetch: mockFetch((body) => {
        assert.equal(body.model, "gpt-6-astra");
        assert.equal(body.text.format.type, "json_schema");
        assert.equal(body.text.format.strict, true);
        assert.equal(body.reasoning.effort, "low");
        assert.match(JSON.stringify(body.input), /What matters most/);
        assert.match(JSON.stringify(body.input), /Capacity matters/);
        assert.equal(
          body.tools.some((t: any) =>
            /approve|purchase|place_order/.test(t.name),
          ),
          false,
        );
        return answer("Let's find something with room for your day.");
      }),
    },
  });
  assert.equal(
    result.speakable[0]?.content,
    "Let's find something with room for your day.",
  );
});

test("model can choose multiple tools then compose one natural response", async () => {
  const opts = setup();
  let calls = 0;
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      model: "gpt-6-astra",
      fetch: mockFetch((body) => {
        calls++;
        if (calls === 1)
          return {
            output: [
              {
                type: "function_call",
                name: "search_catalog",
                arguments: JSON.stringify({ category: "bags", query: "bag" }),
                call_id: "search",
              },
            ],
          };
        if (calls === 2) {
          const toolOutput = body.input.find(
            (item: any) =>
              item.type === "function_call_output" && item.call_id === "search",
          );
          assert.equal(JSON.parse(toolOutput.output).ok, true);
          assert.ok(JSON.parse(toolOutput.output).data.products.length > 0);
          assert.ok(
            body.input.some(
              (item: any) =>
                item.type === "function_call_output" &&
                item.call_id === "search",
            ),
          );
          return {
            output: [
              {
                type: "function_call",
                name: "search_catalog",
                arguments: JSON.stringify({
                  category: "bags",
                  query: "work gym",
                }),
                call_id: "refine",
              },
            ],
          };
        }
        if (calls === 3)
          return toolCall("shortlist", { entries: [{
            productId: opts.store.listProducts("bags")[0]!.id,
            fitReason: "An available bag to explore.",
            compromise: "Check the dimensions against what you carry.",
          }] });
        return answer("Here are some bags to explore.");
      }),
    },
  });
  assert.equal(result.heading, "Room for your day");
  assert.equal(calls, 4);
  assert.equal(result.speakable.length, 1);
  assert.equal(opts.store.get(opts.input.sessionId)?.view, "shortlist");
});

test("a catalog search followed by an empty display gets one chance to show options", async () => {
  const opts = setup();
  opts.input.text = "The carousel is not showing the options. Show me the actual products.";
  const productId = opts.store.listProducts("bags")[0]!.id;
  let requests = 0;
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      fetch: mockFetch((body) => {
        requests++;
        assert.match(body.instructions, /do not start a software-debugging conversation/);
        if (requests === 1)
          return toolCall("search_catalog", { category: "bags", query: "bag" });
        if (requests === 2)
          return answer("I've got a few. Let me sort through them.");
        if (requests === 3) {
          assert.equal(body.input.at(-1).role, "developer");
          assert.match(body.input.at(-1).content, /call shortlist/);
          return toolCall("shortlist", { entries: [{
            productId,
            fitReason: "An available bag to explore.",
            compromise: "Check the dimensions against what you carry.",
          }] });
        }
        return answer("This bag is now on screen.");
      }),
    },
  });
  assert.equal(requests, 4);
  assert.deepEqual(opts.store.get(opts.input.sessionId)?.displayOrder, [productId]);
  assert.equal(opts.store.get(opts.input.sessionId)?.view, "shortlist");
  assert.equal(result.speakable[0]?.content, "This bag is now on screen.");
});

test("missing-display recovery remains bounded and permits a grounded no-match answer", async () => {
  const opts = setup();
  let requests = 0;
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      fetch: mockFetch(() => {
        requests++;
        if (requests === 1)
          return toolCall("search_catalog", { category: "bags", query: "bag" });
        return answer("I can't verify a match for every requirement in these results.");
      }),
    },
  });
  assert.equal(requests, 3);
  assert.deepEqual(opts.store.get(opts.input.sessionId)?.displayOrder, []);
  assert.equal(result.proposals.length, 0);
  assert.match(result.speakable[0]!.content, /can't verify a match/);
});

test("searches with already visible products do not repeat the display action", async () => {
  const opts = setup();
  const productId = opts.store.listProducts("bags")[0]!.id;
  const selected = opts.store.apply({
    ...opts.input,
    eventId: "earlier-shortlist",
    action: "shortlist",
    payload: { entries: [{ productId, fitReason: "A bag to explore.", compromise: "Check fit." }] },
    evidenceIds: [],
  });
  assert.equal(selected.ok, true);
  opts.input.baseRevision = selected.snapshot.revision;
  opts.thread.snapshot = selected.snapshot;
  let requests = 0;
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      fetch: mockFetch(() => {
        requests++;
        if (requests === 1)
          return toolCall("search_catalog", { category: "bags", query: productId });
        return answer("We can keep exploring the option already on screen.");
      }),
    },
  });
  assert.equal(requests, 2);
  assert.equal(result.proposals.length, 0);
  assert.deepEqual(opts.store.get(opts.input.sessionId)?.displayOrder, [productId]);
});

test("provider errors are explicit and never trigger scripted fallback", async () => {
  await assert.rejects(
    openEndedLoop({
      ...setup(),
      config: {
        apiKey: "test",
        model: "gpt-6-astra",
        fetch: async () =>
          new Response("private provider error", { status: 401 }),
      },
    }),
    /shopping_agent_provider_error_401/,
  );
});

test("cancellation discards in-flight model output before tools run", async () => {
  const controller = new AbortController();
  const opts = setup();
  const result = await openEndedLoop({
    ...opts,
    cancel: controller.signal,
    config: {
      apiKey: "test",
      model: "gpt-6-astra",
      fetch: mockFetch(() => {
        controller.abort();
        return answer("obsolete answer");
      }),
    },
  });
  assert.equal(result.cancelled, true);
  assert.deepEqual(result.speakable, []);
  assert.equal(opts.store.get(opts.input.sessionId)?.revision, 0);
});

test("bounded tool budget reports failure instead of looping forever", async () => {
  await assert.rejects(
    openEndedLoop({
      ...setup(),
      config: {
        apiKey: "test",
        model: "gpt-6-astra",
        maxIterations: 2,
        fetch: mockFetch(() => ({
          output: [
            {
              type: "function_call",
              name: "search_catalog",
              arguments: "{}",
              call_id: "again",
            },
          ],
        })),
      },
    }),
    /shopping_agent_step_limit/,
  );
});

test("the final iteration answers from the accepted shortlist instead of requesting more tools", async () => {
  const opts = setup();
  const productId = opts.store.listProducts("bags")[0]!.id;
  let requests = 0;
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      maxIterations: 3,
      fetch: mockFetch((body) => {
        requests++;
        if (requests === 1)
          return toolCall("search_catalog", { category: "bags", query: "bag" });
        if (requests === 2) {
          assert.match(body.input.at(-1).content, /last opportunity/);
          return toolCall("shortlist", { entries: [{
            productId,
            fitReason: "An available bag to explore.",
            compromise: "Check the dimensions against what you carry.",
          }] });
        }
        assert.equal(body.tool_choice, "none");
        assert.match(body.instructions, /latest accepted tool results/);
        const result = body.input.find((item: any) =>
          item.type === "function_call_output" && item.call_id === "shortlist");
        assert.deepEqual(JSON.parse(result.output).snapshot.displayOrder, [productId]);
        return answer("This bag is on screen. Check its dimensions against what you carry.");
      }),
    },
  });
  assert.equal(requests, 3);
  const accepted = opts.store.get(opts.input.sessionId)!;
  assert.equal(accepted.view, "shortlist");
  assert.deepEqual(accepted.displayOrder, [productId]);
  assert.equal(result.speakable[0]?.revision, accepted.revision);
  assert.match(result.speakable[0]!.content, /This bag is on screen/);
  assert.equal(result.cancelled, false);
});

test("a one-request budget returns a grounded limitation without any shopping mutation", async () => {
  const opts = setup();
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      maxIterations: 1,
      fetch: mockFetch((body) => {
        assert.equal(body.tool_choice, "none");
        return answer("I haven't checked the catalog yet, so I can't show a verified match.");
      }),
    },
  });
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(opts.store.get(opts.input.sessionId)?.displayOrder, []);
  assert.match(result.speakable[0]!.content, /haven't checked/);
});

test("an offer choice reaches its exact review with one model response", async () => {
  const opts = setup();
  const { OFFERS } = await import("../fixtures/catalog.js");
  const offer = OFFERS.find((o) => o.availability === "in_stock" && o.unitPriceMinor !== null && o.shippingMinor !== null)!;
  opts.input.text = "Let's continue with that offer";
  let requests = 0;
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      fetch: mockFetch(() => {
        requests++;
        if (requests > 1) return answer("The review was not prepared.");
        return toolCall("prepare_summary", { offerId: offer.id });
      }),
    },
  });
  assert.equal(requests, 1, "review must not wait for a second model response");
  assert.match(result.speakable[0]!.content, /^Summary:/);
  assert.equal(opts.store.get(opts.input.sessionId)?.approvalStatus, "presenting");
});

test("checkout summary is returned verbatim without another model rewrite", async () => {
  const opts = setup();
  const { OFFERS } = await import("../fixtures/catalog.js");
  const offer = OFFERS.find(
    (o) =>
      o.availability === "in_stock" &&
      o.unitPriceMinor !== null &&
      o.shippingMinor !== null,
  )!;
  const selected = opts.store.apply({
    ...opts.input,
    eventId: "select",
    action: "select_offer",
    payload: { offerId: offer.id },
    evidenceIds: [],
  });
  assert.equal(selected.ok, true);
  opts.input.baseRevision = selected.snapshot.revision;
  opts.thread.snapshot = selected.snapshot;
  let requests = 0;
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      model: "gpt-6-astra",
      fetch: mockFetch(() => {
        requests++;
        return {
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Untrusted paraphrase" }],
            },
            {
              type: "function_call",
              name: "prepare_summary",
              arguments: "{}",
              call_id: "summary",
            },
          ],
        };
      }),
    },
  });
  assert.equal(requests, 1);
  assert.equal(result.speakable.length, 1);
  assert.match(result.speakable[0]!.content, /^Summary:/);
  assert.doesNotMatch(result.speakable[0]!.content, /Untrusted paraphrase/);
  assert.equal(
    opts.store.get(opts.input.sessionId)?.approvalStatus,
    "presenting",
  );
});

test("conversational turn still ingests authoritative input and advances revision", async () => {
  const { AuthoritativeSessionStore } =
    await import("../session/AuthoritativeSessionStore.js");
  const { VoiceOrchestrator } = await import("./VoiceOrchestrator.js");
  const { FixtureVoiceAdapter } = await import("../voice/adapter.js");
  const store = new AuthoritativeSessionStore();
  const orchestrator = new VoiceOrchestrator(store, new FixtureVoiceAdapter(), {
    agent: {
      apiKey: "test",
      model: "gpt-6-astra",
      fetch: mockFetch(() => answer("Happy to help you find a bag.")),
    },
  });
  const snapshot = orchestrator.createSession();
  const input = {
    ...setup().input,
    sessionId: snapshot.sessionId,
    epoch: snapshot.epoch,
    baseRevision: snapshot.revision,
  };
  const result = await orchestrator.handleInput(input);
  assert.equal(result.route, "open_ended");
  assert.ok(result.snapshot.revision > snapshot.revision);
  assert.equal(result.speakable[0]?.revision, result.snapshot.revision);
  assert.equal(orchestrator.turnsFor(snapshot.sessionId).active, null);
});

test("provider failure clears active orchestrator turn", async () => {
  const { VoiceOrchestrator } = await import("./VoiceOrchestrator.js");
  const { FixtureVoiceAdapter } = await import("../voice/adapter.js");
  const opts = setup();
  const orchestrator = new VoiceOrchestrator(
    opts.store,
    new FixtureVoiceAdapter(),
    {
      agent: {
        apiKey: "test",
        model: "gpt-6-astra",
        fetch: async () => new Response("", { status: 503 }),
      },
    },
  );
  await assert.rejects(
    orchestrator.handleInput(opts.input),
    /provider_error_503/,
  );
  assert.equal(orchestrator.turnsFor(opts.input.sessionId).active, null);
});

test("progress describes real tool stages and persists context during the next model request", async () => {
  const opts = setup();
  opts.input.text = "Can you find a more affordable bag?";
  const progress: Array<{ turnId: string; label: string }> = [];
  let requests = 0;
  await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      model: "gpt-6-astra",
      onActivity: (event) => progress.push(event),
      fetch: mockFetch(() => {
        requests++;
        if (requests === 1) {
          assert.equal(progress.at(-1)?.label, "Considering your request…");
          assert.equal(
            progress.some((event) => /affordable/.test(event.label)),
            false,
          );
          return {
            output: [
              {
                type: "function_call",
                name: "search_catalog",
                arguments: JSON.stringify({
                  category: "bags",
                  query: "cheaper",
                }),
                call_id: "search",
              },
            ],
          };
        }
        assert.equal(
          progress.at(-1)?.label,
          "Considering more affordable options…",
        );
        assert.ok(
          progress.some(
            (event) => event.label === "Looking for more affordable options…",
          ),
        );
        assert.ok(
          progress.every((event) => event.turnId === opts.input.turnId),
        );
        return answer("Let's look at these options.");
      }),
    },
  });
});

test("malformed structured replies fail without speaking JSON or leaking provider text", async () => {
  await assert.rejects(
    openEndedLoop({
      ...setup(),
      config: {
        apiKey: "test",
        model: "gpt-6-astra",
        fetch: mockFetch(() => ({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: '{"heading":"A title","message":17}',
                },
              ],
            },
          ],
        })),
      },
    }),
    /shopping_agent_invalid_reply/,
  );
});

test("narration cues require exact accepted text and visible product IDs", async () => {
  for (const segments of [
    [{ text: "Let's explore.", productId: null }],
    [{ text: "Different words", productId: null }],
    [{ text: "Let's explore.", productId: "invented" }],
  ]) {
    const result = await openEndedLoop({
      ...setup(),
      config: {
        apiKey: "test",
        model: "gpt-6-astra",
        fetch: mockFetch(() => ({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    heading: "Explore",
                    message: "Let's explore.",
                    segments,
                  }),
                },
              ],
            },
          ],
        })),
      },
    });
    if (segments[0].text === "Let's explore." && segments[0].productId === null)
      assert.deepEqual(result.narrationSegments, segments);
    else assert.equal(result.narrationSegments, undefined);
    assert.equal(result.speakable[0]?.content, "Let's explore.");
  }
});

test("automatic model routing reaches provider requests without changing tools", async () => {
  const opts = setup();
  opts.input.text = "Compare price, capacity and weight";
  await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      fetch: mockFetch((body) => {
        assert.equal(body.model, "gpt-6.1-sol");
        assert.equal(body.reasoning.effort, "low");
        assert.equal(body.service_tier, "fast");
        assert.equal(
          body.tools.some((tool: any) =>
            /approve|purchase|place_order/.test(tool.name),
          ),
          false,
        );
        return answer("Here are the differences.");
      }),
    },
  });
});

test("research keeps Sol low and Fast mode across the complete tool loop", async () => {
  const opts = setup();
  opts.input.text = "Research this product's long-term cost";
  let requests = 0;
  await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      fetch: mockFetch((body) => {
        requests++;
        assert.equal(body.model, "gpt-6.1-sol");
        assert.deepEqual(body.reasoning, { effort: "low" });
        assert.equal(body.service_tier, "fast");
        return requests === 1
          ? toolCall("inspect_product", { productId: "BAG-024" })
          : answer("Here is the supported comparison.");
      }),
    },
  });
  assert.equal(requests, 2);
});

test("explicit model, effort and service tier reach the provider unchanged", async () => {
  const opts = setup();
  opts.input.text = "Research these products";
  await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      model: "gpt-6-astra",
      reasoningEffort: "high",
      serviceTier: "default",
      fetch: mockFetch((body) => {
        assert.equal(body.model, "gpt-6-astra");
        assert.deepEqual(body.reasoning, { effort: "high" });
        assert.equal(body.service_tier, "default");
        return answer("Here is the comparison.");
      }),
    },
  });
});

test("simple checkout does not inherit the research model or Fast mode", async () => {
  const opts = setup();
  opts.input.text = "Continue with the EarPods";
  opts.thread.snapshot.hardConstraints = { budgetMinor: 5000, category: "audio", compatibility: { hostConnection: "USB-C" } };
  await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      fetch: mockFetch((body) => {
        assert.equal(body.model, "gpt-6-luna");
        assert.deepEqual(body.reasoning, { effort: "none" });
        assert.equal(Object.hasOwn(body, "service_tier"), false);
        return answer("Let's review that offer.");
      }),
    },
  });
});

test("direction cards are a complete result, so catalog display repair does not rush into products", async () => {
  const opts = setup();
  opts.input.text = "Help me sound clearer during calls in a noisy room";
  let requests = 0;
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      fetch: mockFetch((body) => {
        requests++;
        if (requests === 1) return toolCall("search_catalog", { category: "audio", query: "microphone" });
        if (requests === 2) return toolCall("show_solution_types", { question: "Will you stay at a desk, or move around?" });
        assert.match(body.instructions, /wait for the shopper's next turn/);
        assert.doesNotMatch(body.input.at(-1).content ?? "", /last opportunity|does not show product cards/);
        return answer("A headset keeps the mic near your mouth, a lavalier moves with you, and a desk mic needs close placement. Will you stay at a desk, or move around?");
      }),
    },
  });
  assert.equal(requests, 3);
  assert.equal(opts.store.get(opts.input.sessionId)!.view, "solution_types");
  assert.deepEqual(opts.store.get(opts.input.sessionId)!.displayOrder, []);
  assert.equal(result.proposals.at(-1)?.action, "clarify");
});

test("an unclear audio need can be explored conversationally without showing a questionnaire", async () => {
  const opts = setup();
  opts.input.text = "People struggle to hear me on calls. I don't know what I need.";
  let requests = 0;
  const result = await openEndedLoop({
    ...opts,
    config: {
      apiKey: "test",
      fetch: mockFetch(() => {
        requests++;
        return answer("A mic closer to your mouth can help more than a more expensive one. Are you usually at the same desk for these calls?");
      }),
    },
  });
  assert.equal(requests, 1);
  assert.equal(result.proposals.length, 0);
  assert.equal(opts.store.get(opts.input.sessionId)!.view, "opening");
  assert.deepEqual(opts.store.get(opts.input.sessionId)!.displayOrder, []);
});
