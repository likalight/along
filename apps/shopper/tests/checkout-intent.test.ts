import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CheckoutIntentError,
  interpretCheckoutIntent,
  type CheckoutIntentContext,
  type CheckoutIntentDecision,
} from "@/lib/checkout/intent";

const review: NonNullable<CheckoutIntentContext["review"]> = {
  id: "review-current",
  revision: 7,
  displayed: true,
  product: "RØDE NT-USB Mini",
  totalMinor: 11900,
  currency: "USD",
};
const context: CheckoutIntentContext = {
  text: "make the purchase",
  latestRequest: "I'd like the RØDE",
  stage: "review",
  review,
  approvalPromptActive: true,
  lastAssistantMessage: "Would you like me to place this order?",
  recentTurns: [
    { role: "shopper", text: "I have a dongle, no worries" },
    { role: "assistant", text: "The complete total is USD 119." },
  ],
};
const approval: CheckoutIntentDecision = {
  intent: "approve_order",
  authorization: "explicit",
  summaryId: review.id,
};
const clarification: CheckoutIntentDecision = {
  intent: "clarify",
  authorization: "none",
  summaryId: null,
};

function providerBody(value: unknown) {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(value) }],
      },
    ],
  };
}
function provider(value: unknown = approval) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(providerBody(value)));
}

afterEach(() => vi.unstubAllEnvs());

describe("semantic checkout intent", () => {
  it("sends the complete accepted context and uses the returned meaning without a lexical gate", async () => {
    const fetch = provider();
    const before = structuredClone(context);
    expect(
      await interpretCheckoutIntent(context, { apiKey: "test-key", fetch }),
    ).toEqual(approval);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.headers).toEqual({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    const request = JSON.parse(init!.body as string);
    expect(JSON.parse(request.input[0].content)).toEqual({
      ...context,
      assentContextCurrent: true,
    });
    expect(request).toMatchObject({
      model: "gpt-6-luna",
      reasoning: { effort: "none" },
      max_output_tokens: 150,
      store: false,
      text: {
        format: {
          type: "json_schema",
          strict: true,
          schema: {
            additionalProperties: false,
            required: ["intent", "authorization", "summaryId"],
          },
        },
      },
    });
    expect(request.tools).toBeUndefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(context).toEqual(before);
  });

  it("uses the same utterance to prepare an unreviewed order according to the semantic decision", async () => {
    const decision: CheckoutIntentDecision = {
      intent: "prepare_order",
      authorization: "none",
      summaryId: null,
    };
    const fetch = provider(decision);
    expect(
      await interpretCheckoutIntent(
        { text: context.text, stage: "selected", approvalPromptActive: false },
        { apiKey: "test", fetch },
      ),
    ).toEqual(decision);
  });

  it.each([
    "change_order",
    "cancel_order",
    "question",
    "continue_shopping",
    "clarify",
  ] as const)(
    "respects a provider %s decision rather than approving text that contains a purchase phrase",
    async (intent) => {
      const decision: CheckoutIntentDecision = {
        intent,
        authorization: "none",
        summaryId: null,
      };
      const text =
        "Make the purchase — that was an example, and I need to discuss the delivery first.";
      const fetch = provider(decision);
      expect(
        await interpretCheckoutIntent(
          { ...context, text },
          { apiKey: "test", fetch },
        ),
      ).toEqual(decision);
      expect(
        JSON.parse(
          JSON.parse(fetch.mock.calls[0][1]!.body as string).input[0].content,
        ).text,
      ).toBe(text);
    },
  );

  it("gives the interpreter current permission context separately from historical intent and setup reassurance", async () => {
    const fetch = provider(clarification);
    const current = {
      ...context,
      text: "Yes, I've got a dongle",
      approvalPromptActive: false,
      lastAssistantMessage: "Do you already have the adapter?",
    };
    await interpretCheckoutIntent(current, { apiKey: "test", fetch });
    const request = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(JSON.parse(request.input[0].content)).toEqual({
      ...current,
      assentContextCurrent: true,
    });
    expect(request.instructions).toContain(
      "Routine setup reassurance alone is not purchase approval",
    );
    expect(request.instructions).toContain("Quoted, reported, hypothetical");
    expect(request.instructions).toContain("question takes precedence");
  });

  it("allows semantic assent to the actual last approval question even without a cached prompt flag", async () => {
    const assent: CheckoutIntentDecision = {
      ...approval,
      authorization: "assent",
    };
    expect(
      await interpretCheckoutIntent(
        { ...context, text: "Please do", approvalPromptActive: false },
        { apiKey: "test", fetch: provider(assent) },
      ),
    ).toEqual(assent);
  });

  it.each([false, true])(
    "rejects assent tied to an older review even when approvalPromptActive is %s",
    async (approvalPromptActive) => {
      const fetch = provider({ ...approval, authorization: "assent" });
      expect(
        await interpretCheckoutIntent(
          {
            ...context,
            text: "Yes, please",
            approvalPromptActive,
            assentContextCurrent: false,
          },
          { apiKey: "test", fetch },
        ),
      ).toEqual(clarification);
      const request = JSON.parse(fetch.mock.calls[0][1]!.body as string);
      expect(JSON.parse(request.input[0].content)).toMatchObject({
        assentContextCurrent: false,
        lastAssistantMessage: "Would you like me to place this order?",
      });
    },
  );

  it("allows assent when the invitation belongs to the displayed current review", async () => {
    const assent: CheckoutIntentDecision = {
      ...approval,
      authorization: "assent",
    };
    expect(
      await interpretCheckoutIntent(
        { ...context, text: "Yes, please", assentContextCurrent: true },
        { apiKey: "test", fetch: provider(assent) },
      ),
    ).toEqual(assent);
  });

  it("allows an explicit current purchase instruction without borrowing an older invitation", async () => {
    expect(
      await interpretCheckoutIntent(
        {
          ...context,
          text: "Make the purchase",
          approvalPromptActive: false,
          assentContextCurrent: false,
        },
        { apiKey: "test", fetch: provider(approval) },
      ),
    ).toEqual(approval);
  });

  it.each([
    { ...context, review: undefined },
    { ...context, review: { ...review, displayed: false } },
    { ...context, stage: "shopping" as const },
    { ...context, stage: "selected" as const },
    { ...context, stage: "complete" as const },
    { ...context, review: { ...review, id: "different-review" } },
  ])(
    "rejects approval without the exact displayed current review",
    async (input) => {
      expect(
        await interpretCheckoutIntent(input, {
          apiKey: "test",
          fetch: provider(),
        }),
      ).toEqual(clarification);
    },
  );

  it.each([
    { ...approval, authorization: "none" as const },
    { ...approval, summaryId: null },
  ])(
    "rejects approval without authorization and review identity",
    async (decision) => {
      expect(
        await interpretCheckoutIntent(context, {
          apiKey: "test",
          fetch: provider(decision),
        }),
      ).toEqual(clarification);
    },
  );

  it("rejects assent when no current approval context was supplied", async () => {
    expect(
      await interpretCheckoutIntent(
        {
          ...context,
          approvalPromptActive: false,
          lastAssistantMessage: undefined,
        },
        {
          apiKey: "test",
          fetch: provider({ ...approval, authorization: "assent" }),
        },
      ),
    ).toEqual(clarification);
  });

  it("does not restart a completed order", async () => {
    expect(
      await interpretCheckoutIntent(
        { ...context, stage: "complete" },
        {
          apiKey: "test",
          fetch: provider({
            intent: "prepare_order",
            authorization: "none",
            summaryId: null,
          }),
        },
      ),
    ).toEqual(clarification);
  });

  it("acknowledges an existing receipt without creating new authorization", async () => {
    const decision: CheckoutIntentDecision = {
      intent: "acknowledge_order",
      authorization: "none",
      summaryId: null,
    };
    expect(
      await interpretCheckoutIntent(
        { ...context, stage: "complete", text: "Yes, go ahead with that one" },
        { apiKey: "test", fetch: provider(decision) },
      ),
    ).toEqual(decision);
    expect(
      await interpretCheckoutIntent(context, {
        apiKey: "test",
        fetch: provider(decision),
      }),
    ).toEqual(clarification);
  });

  it("bounds history by complete turns and preserves the whole current utterance", async () => {
    const fetch = provider(clarification);
    const text = `${"x".repeat(3940)} but only after I have checked the shipping cost.`;
    await interpretCheckoutIntent(
      {
        ...context,
        text,
        recentTurns: Array.from({ length: 12 }, (_, index) => ({
          role: "shopper" as const,
          text: `${index}: ${"x".repeat(1000)}`,
        })),
      },
      { apiKey: "test", fetch },
    );
    const sent = JSON.parse(
      JSON.parse(fetch.mock.calls[0][1]!.body as string).input[0].content,
    );
    expect(sent.text).toBe(text);
    expect(sent.recentTurns).toHaveLength(3);
    expect(sent.recentTurns[0].text).toMatch(/^9: /);
    expect(sent.recentTurns.at(-1).text).toMatch(/^11: /);
  });

  it("does not truncate an oversized request into purchase approval", async () => {
    const fetch = provider();
    await expect(
      interpretCheckoutIntent(
        { ...context, text: `${"buy ".repeat(1001)}unless it is expensive` },
        { apiKey: "test", fetch },
      ),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...approval, intent: "pay_now" },
    { ...approval, authorization: "yes" },
    { ...approval, summaryId: 1 },
    { ...approval, summaryId: "x".repeat(257) },
    { ...approval, tool: "purchase" },
    {
      intent: "prepare_order",
      authorization: "explicit",
      summaryId: review.id,
    },
  ])(
    "rejects malformed structured decisions without a phrase fallback",
    async (decision) => {
      await expect(
        interpretCheckoutIntent(context, {
          apiKey: "test",
          fetch: provider(decision),
        }),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each([
    { status: "incomplete", output: providerBody(approval).output },
    { status: "failed", error: { message: "private details" }, output: [] },
    { output: [{ type: "function_call", name: "purchase" }] },
    {
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "No" }] },
      ],
    },
    {
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "not json" }],
        },
      ],
    },
  ])(
    "rejects incomplete, tool, refusal and non-JSON provider replies",
    async (body) => {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(Response.json(body));
      await expect(
        interpretCheckoutIntent(context, { apiKey: "test", fetch }),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("uses the server key when no test override is provided", async () => {
    vi.stubEnv("OPENAI_API_KEY", "server-key");
    const fetch = provider();
    await interpretCheckoutIntent(context, { fetch });
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer server-key",
    });
  });

  it("does not call a provider when unconfigured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetch = provider();
    await expect(
      interpretCheckoutIntent(context, { fetch }),
    ).rejects.toBeInstanceOf(CheckoutIntentError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws an actionable neutral error on provider failure without leaking its response", async () => {
    const before = structuredClone(context);
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response("private provider details", { status: 503 }),
      );
    await expect(
      interpretCheckoutIntent(context, { apiKey: "test", fetch }),
    ).rejects.toThrow(
      "I couldn't interpret that checkout request just now. Please try again.",
    );
    expect(context).toEqual(before);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("times out a stalled request with no local approval fallback", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener(
            "abort",
            () => reject(init!.signal!.reason),
            { once: true },
          );
        }),
    );
    await expect(
      interpretCheckoutIntent(context, { apiKey: "test", fetch, timeoutMs: 5 }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
