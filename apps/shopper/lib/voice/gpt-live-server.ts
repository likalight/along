import WebSocket from "ws";
import { getRuntime } from "@/lib/integration/runtime";
import { project } from "@/lib/integration/projection";
import { readActivity } from "@/lib/integration/activity";
import { AUDIO_SOLUTION_CHOICES } from "@/lib/canvas/solution-choices";
import {
  classifyCheckoutReply,
  completeLiveDemoCheckout,
  isLiveDemoConfirmation,
} from "./live-demo-checkout";
import {
  asksForOrderApproval,
  LiveApprovalContext,
  ORDER_APPROVAL_QUESTION,
} from "./live-approval-context";

// Also sent once to calls already open when this policy changes in development.
// Keep this within one Live append (500 tokens; append caps at 1,500 characters).
export const LIVE_SHOPPING_GUARDRAILS = `Stay in Along's shopping role. You cannot debug software, inspect code, change the app, or act as a developer. Redirect unrelated requests to shopping. You cannot approve purchases yourself.
Start with the shopper's problem. If the approach is unclear, ask one useful everyday question and discuss the relevant tradeoff. Do not recite every microphone type, impose choice cards or run a questionnaire. Offer a small visual comparison only if helpful or requested. Use what they already told you; move to products when a direction is clear.
Generate <|SpawnThinking|> to display products, record choices or corrected preferences, navigate, or handle checkout. A clarified budget must update the filter now; never ask them to repeat a value you heard. Treat display complaints as shopping requests. Let unchanged work finish. Acknowledge work once, then listen.
Use confirmed backend results. Never claim products are visible when carouselProductCount is zero or an order is complete without a receipt. Name each new product so the carousel can follow. Speak in connected, relaxed phrases. Yield to deliberate interruptions, then answer after a short natural pause; do not await shopping work for answers you already know. Say any limit aloud with a next step, never silently stop. Keep demo/simulation language out of conversation. After a receipt, warmly confirm once using its delivery estimate; never invent shipment.`;

export const LIVE_INSTRUCTIONS = `You help shoppers choose confidently, only within Along's shopping platform and catalog. Sound like a thoughtful person helping a friend: relaxed, warm and responsive. Use connected thoughts, varied sentence lengths and comfortable pauses. Be concise when the answer is simple, but take enough time to explain a useful tradeoff. Do not sound like a checklist, read every field aloud, or force each answer into a clipped one-liner. Occasional light humour is welcome, never forced.

## Role and display actions
${LIVE_SHOPPING_GUARDRAILS}

## Backchannel policy
Acknowledge required work once in your own words. Allow the shopper thinking pauses and self-corrections. A short "mm-hm" or "yeah" can be a listening sound; do not automatically abandon your thought for it. Avoid repetitive filler or repeated promises to look something up.

## Interruption policy
Yield promptly when the shopper deliberately interrupts or corrects you, even mid-sentence. Do not talk through their request or finish a list first. Once their thought is complete, respond after a short natural pause; do not add a long listening silence or wait for permission to resume. If they hesitate mid-thought, give them room to finish. Stopping speech does not cancel ongoing shopping work. Answer questions from verified context immediately while other work runs; acknowledge changed preferences naturally while the backend updates them. Keep normal phrasing and allow brief acknowledgments without repeatedly stopping and restarting.

## Spoken limits and recovery
When a request is outside your role, a fact cannot be verified, or the backend rejects an action, say the specific limit aloud and offer one useful next step. Never become silent, silently abandon the turn, or repeat the blocked action in a loop. Acknowledge uncertainty naturally without reciting internal rules, tool names, or the word guardrail. Continue the conversation from the current shopping state; this never permits bypassing a constraint or approving on the shopper's behalf.

## Delegation policy
Generate <|SpawnThinking|> when showing requested choices, recording a direction, retrieving or navigating products, substantial comparison, changed constraints, or checkout require backend work. Help with broad problems conversationally before choosing specific products. Ask only the next question that matters, grounded in what they said. Do not force an exhaustive category menu or a second decision after they already indicated a preference. Ordinary conversation does not need delegation, but a clarification that supplies or corrects a budget, preference or requirement does: pass the newly heard value to the backend immediately, even if the shopper only says "around fifty dollars". Never ask them to repeat an understood correction in another message or treat an outdated filter as an unchangeable limit. Until the update returns, acknowledge their intent without claiming the stored filter has changed. Display requests still need backend work even when you know the choices. Start work before acknowledging it naturally. Never invent prices, availability, progress, or completed actions.

## Backend tools
The Along shopping harness can show choices, remember preferences, retrieve and filter products, compare, navigate and prepare checkout. Backend results are authoritative. Once a direction is clear, prefer three qualifying products; do not pad results. Name each product when moving to it, then relate its useful difference to the shopper's needs. Avoid reciting a templated pros-and-cons script. Reuse verified results and explain material uncertainty in plain language.

## Purchase policy
You cannot approve a purchase yourself. When the shopper has chosen a product and says proceed or continue, delegate preparation of its order review using the accepted selection and known requirements. Ask only for a missing fact needed to choose an eligible offer. After they answer that question, carry their request to proceed forward; do not ask them to choose the product again or offer another comparison unless they request it. Once the order details are on screen, an explicit purchase instruction is approval even if the shopper interrupts your readout. Immediately generate <|SpawnThinking|>; do not finish reciting the offer, repeat delivery details, or ask for approval again. If no order review exists yet, delegate preparation and ask for approval once the details are displayed. Otherwise briefly review the current order, then ask "Would you like me to place this order?" Accept natural replies: generate <|SpawnThinking|> for a purchase request such as "please buy it", or "yes please" answering that order question. Never require a special word or ask the shopper to repeat an understood approval. A yes answering a different question, a conditional response or a requested change is not approval. Delegate the actual words and wait for the result. Only the server can complete the order. If approval is rejected, keep the order in view and explain the next step; do not return to recommendations. After a confirmed receipt say warmly that the order is confirmed, give the accepted delivery estimate, and add a short encouragement suited to the purchase. For example: "You're all set. It's expected by Friday. Hope your next call sounds much clearer." After that, ordinary acknowledgments such as "that's good" or "thanks" need only a natural conversational reply, never delegation, another checkout attempt or a repeated receipt announcement. Never say shipped, on its way, or arriving tomorrow unless the receipt actually supports it. Keep simulated, hypothetical, demo and no-payment wording out of spoken dialogue. Do not invent reviews or treat fictional ratings as customer evidence.`;

export type LiveFragment = { delta: string; start_ms: number; end_ms: number };
/** Provider timestamps, not browser text or arrival silence, delimit delegated input. */
export class LiveTranscriptBuffer {
  private fragments: LiveFragment[] = [];
  private responses: LiveFragment[] = [];
  private consumed = -1;
  private seen = new Set<string>();
  add(event: Record<string, any>) {
    if (
      typeof event.delta !== "string" ||
      !Number.isFinite(event.start_ms) ||
      !Number.isFinite(event.end_ms)
    )
      return;
    if (event.event_id && this.seen.has(event.event_id)) return;
    if (event.event_id) this.seen.add(event.event_id);
    if (this.seen.size > 2048)
      this.seen.delete(this.seen.values().next().value!);
    this.fragments.push({
      delta: event.delta,
      start_ms: event.start_ms,
      end_ms: event.end_ms,
    });
    if (this.fragments.length > 512) this.fragments.shift();
  }
  peek(offset: number) {
    const pieces = this.fragments
      .filter((x) => x.end_ms > this.consumed && x.start_ms <= offset)
      .sort((a, b) => a.start_ms - b.start_ms);
    return {
      text: pieces
        .map((x) => x.delta)
        .join("")
        .trim()
        .slice(-4000),
      endMs: pieces.length ? Math.max(...pieces.map((x) => x.end_ms)) : -1,
    };
  }
  take(offset: number) {
    const preview = this.peek(offset);
    this.consumed = Math.max(this.consumed, preview.endMs);
    return preview.text;
  }
  observeOutput(event: Record<string, any>) {
    if (
      typeof event.delta !== "string" ||
      !Number.isFinite(event.start_ms) ||
      !Number.isFinite(event.end_ms)
    )
      return;
    this.responses.push({
      delta: event.delta,
      start_ms: event.start_ms,
      end_ms: event.end_ms,
    });
    this.responses = this.responses.slice(-512);
  }
  /** Isolate a new request after a substantive assistant response. An answer
   * to a question may itself be cut off mid-sentence. Keep the complete batch
   * for shopping context; never use a pause or backchannel as a boundary. */
  latestRequest(offset: number) {
    const pieces = this.fragments
      .filter((part) => part.end_ms > this.consumed && part.start_ms <= offset)
      .sort((a, b) => a.start_ms - b.start_ms);
    let start = 0;
    for (let index = 1; index < pieces.length; index++) {
      const previousEnd = Math.max(
        ...pieces.slice(0, index).map((part) => part.end_ms),
      );
      const responseParts = this.responses
        .filter(
          (part) =>
            part.start_ms >= previousEnd &&
            part.start_ms < pieces[index].start_ms,
        )
        .sort((a, b) => a.start_ms - b.start_ms);
      const response = responseParts
        .map((part) => part.delta)
        .join("")
        .trim();
      const previousText = pieces
        .slice(start, index)
        .map((part) => part.delta)
        .join("")
        .trim();
      const answeredQuestion =
        /^(?:when|what|how|where|why|can|could|would|will|is|are|does|do)\b/i.test(
          previousText,
        );
      const completedResponse =
        /[.!?]$/.test(response) &&
        responseParts.every((part) => part.end_ms <= pieces[index].start_ms);
      // A dangling condition must not disappear when the assistant talks over
      // it. A new explicit command after a separately answered question can.
      const openCondition =
        /\b(?:if|unless|provided|as long as|only when)\b/i.test(previousText);
      if (
        !openCondition &&
        (completedResponse || answeredQuestion) &&
        response.split(/\s+/).length >= 4
      )
        start = index;
    }
    return pieces
      .slice(start)
      .map((part) => part.delta)
      .join("")
      .trim()
      .slice(-4000);
  }
}

type Call = {
  sessionId: string;
  callId: string;
  socket: WebSocket;
  origin: string;
  cookie: string;
  transcripts: LiveTranscriptBuffer;
  approvalContext?: LiveApprovalContext;
  delegations: Set<string>;
  generation: number;
  delegationSequence: number;
  contextRevision: number;
  contextPending?: boolean;
  contextContent?: string;
  guardrails?: string;
  announcedReceiptId?: string;
  turnId?: string;
  pending: boolean;
  error?: string;
  closed: boolean;
  touchedAt: number;
};
const globalCalls = globalThis as unknown as {
  __alongGptLiveCalls?: Map<string, Call>;
};
const calls = (globalCalls.__alongGptLiveCalls ??= new Map<string, Call>());
function append(
  call: Call,
  type: "thinking" | "commentary" | "instructions",
  content: string,
  delegationId: string | null = null,
) {
  if (call.closed || call.socket.readyState !== WebSocket.OPEN) return false;
  call.socket.send(
    JSON.stringify({
      type: `session.${type}.append`,
      event_id: crypto.randomUUID(),
      delegation_id: delegationId,
      content: content.slice(0, 1500),
    }),
  );
  return true;
}
function spokenUpdate(
  s: ReturnType<typeof project>,
  previousSummaryId?: string,
) {
  if (
    s.view === "summary" &&
    s.summary &&
    s.summary.id !== previousSummaryId &&
    Number.isFinite(s.summary.totalMinor)
  ) {
    const product = s.catalog?.products.find(
      (p) => p.id === s.summary?.productId,
    );
    return `Here's your order: ${s.summary.quantity} ${product?.title ?? "selected item"}, for USD ${(s.summary.totalMinor / 100).toFixed(2)} in total. Expected delivery: ${s.summary.deliveryWindow}. The full details are on screen. ${ORDER_APPROVAL_QUESTION}`;
  }
  return s.message;
}
function stateContext(sessionId: string, s = project(sessionId)) {
  const carouselVisible = ["shortlist", "saved_choice"].includes(s.view);
  return JSON.stringify({
    view: s.view,
    purchase: s.receipt
      ? {
          status: "confirmed",
          receiptId: s.receipt.id,
          delivery: s.receipt.acceptedOrder.deliveryWindow,
        }
      : s.summary
        ? {
            status: "review_order",
            summaryId: s.summary.id,
            instruction:
              "The order details are displayed. Immediately delegate an explicit purchase request, including an interruption mid-review; do not finish the readout or ask again. For an ambiguous reply ask: Would you like me to place this order?",
          }
        : { status: "not_confirmed" },
    message: spokenUpdate(s)?.slice(0, 450),
    carouselProductCount: carouselVisible ? s.displayOrder.length : 0,
    solutionType: s.canvas?.solution ?? null,
    solutionChoices:
      s.view === "solution_types"
        ? AUDIO_SOLUTION_CHOICES.map((choice, index) => ({
            position: index + 1,
            solutionType: choice.solutionType,
            title: choice.title,
          }))
        : undefined,
    shoppingTaskPending: calls.get(sessionId)?.pending ?? false,
    focusedProduct: s.focusedProductId,
    // The canvas uses catalog + displayOrder; legacy stage cards are always empty.
    products: s.displayOrder.slice(0, 3).map((id) => ({
      id,
      title: s.catalog?.products.find((product) => product.id === id)?.title,
    })),
    needs: s.needs?.slice(0, 3),
    constraints: s.hardConstraints,
    preferences: s.preferences?.slice(0, 4),
  }).slice(0, 1500);
}
function approvalContext(call: Call) {
  // Calls can survive a development reload that adds this bookkeeping.
  return (call.approvalContext ??= new LiveApprovalContext());
}
function approvalSummary(call: Call, snapshot = project(call.sessionId)) {
  const summary = snapshot.summary;
  const stored = getRuntime().store.core.get(call.sessionId).summary;
  return ["summary", "recovery"].includes(snapshot.view) &&
    summary &&
    stored?.displayed &&
    stored.id === summary.id &&
    stored.revision === summary.revision
    ? summary
    : null;
}
/** Record locally sent context so the next state poll does not inject it again.
 * This is transport bookkeeping, not proof of model consumption or playback. */
function appendContext(
  call: Call,
  delegationId: string | null = null,
  snapshot = project(call.sessionId),
) {
  approvalContext(call).expect(approvalSummary(call, snapshot));
  const content = stateContext(call.sessionId, snapshot);
  if (
    content !== call.contextContent &&
    !append(call, "thinking", content, delegationId)
  )
    return;
  call.contextContent = content;
  call.contextRevision = snapshot.revision;
  call.contextPending = call.pending;
}
async function dispatch(
  call: Call,
  action: string,
  input: Record<string, unknown>,
) {
  const { POST } = await import("@/app/api/session/route");
  const response = await POST(
    new Request(`${call.origin}/api/session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: call.cookie,
        origin: call.origin,
      },
      body: JSON.stringify({ action, input }),
    }),
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === "string" ? result.error : "Shopping task failed.",
    );
  return result;
}
async function delegate(call: Call, id: string, offset: number) {
  if (call.delegations.has(id)) return;
  call.delegations.add(id);
  const sequence = ++call.delegationSequence;
  // Briefly coalesce fragments that trail delegation metadata. This is transport buffering,
  // not an assertion that a silence interval establishes a completed utterance.
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (call.closed || sequence !== call.delegationSequence) return;
  let preview = call.transcripts.peek(offset);
  for (let retry = 0; !preview.text && retry < 16; retry++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (call.closed || sequence !== call.delegationSequence) return;
    preview = call.transcripts.peek(offset);
  }
  if (!preview.text) {
    append(
      call,
      "commentary",
      "I didn't catch that request clearly. Could you say it again?",
      id,
    );
    return;
  }
  // offset_ms is the delegation's timeline position, not the end of speech.
  // Text may end before it during silence, or a trailing packet may still be
  // arriving. Keep the prefix unconsumed while briefly settling uncovered text;
  // this bounded transport heuristic does not establish utterance finality.
  const settleDeadline = Date.now() + 300;
  let unchangedSince = Date.now();
  while (
    preview.endMs < offset &&
    Date.now() < settleDeadline &&
    Date.now() - unchangedSince < 150
  ) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (call.closed || sequence !== call.delegationSequence) return;
    const next = call.transcripts.peek(offset);
    if (next.text !== preview.text || next.endMs !== preview.endMs)
      unchangedSince = Date.now();
    preview = next;
  }
  const latestRequest = call.transcripts.latestRequest(offset);
  const text = call.transcripts.take(offset);
  // Only an explicit, complete purchase request can stand on its own after
  // a separately answered question. A bare assent retains its full context.
  const checkoutText =
    classifyCheckoutReply(latestRequest) === "approve" ? latestRequest : text;
  const generation = ++call.generation;
  const { store, orch } = getRuntime();
  const checkoutReply = classifyCheckoutReply(checkoutText);
  const before = project(call.sessionId);
  const review = approvalSummary(call, before);
  const currentSession = store.core.get(call.sessionId);
  // A displayed review outlives narration and read-only discussion. Do not
  // cancel its order state just to stop a model turn; the next input cancels
  // old work, and generation ownership suppresses its late reply.
  const preserveReview =
    review &&
    currentSession.summary?.displayed &&
    currentSession.summary.id === review.id &&
    currentSession.summary.revision === review.revision;
  if (
    call.pending &&
    call.turnId &&
    currentSession.turn?.id === call.turnId &&
    !preserveReview
  )
    await orch.bargeIn(call.sessionId, call.turnId);
  if (generation !== call.generation || call.closed) return;
  const s = project(call.sessionId);
  const previousTurnId = store.core.get(s.sessionId).turn?.id;
  const summaryInView = ["summary", "recovery"].includes(s.view) && s.summary;
  const currentSummary = approvalSummary(call, s);
  const approvalPromptActive = approvalContext(call).consume(currentSummary);
  if (
    s.receipt &&
    (checkoutReply === "assent" ||
      /^(?:thanks|thank you(?: very much)?|great(?:,? thanks)?|perfect(?:,? thanks)?)[.!]?$/i.test(
        text.trim(),
      ))
  ) {
    call.pending = false;
    call.error = undefined;
    append(
      call,
      "commentary",
      "Hope you enjoy it! I'm here if you need anything else.",
      id,
    );
    appendContext(call, id);
    return;
  }
  if (checkoutReply === "assent" && summaryInView && !approvalPromptActive) {
    // Clarify the referent of a short reply without starting a new agent turn,
    // which would discard the order the shopper is already reviewing.
    call.pending = false;
    call.error = undefined;
    const question = currentSummary
      ? ORDER_APPROVAL_QUESTION
      : "I need a fresh review of the order details before I can place it. Please ask me to review the order again.";
    if (append(call, "commentary", question, id) && currentSummary)
      approvalContext(call).arm(currentSummary);
    appendContext(call, id);
    return;
  }
  // Live transcript fragments never become final/confident approval evidence.
  // This separate server-only path is limited to the displayed demo order and
  // can issue only its synthetic receipt, never a payment or merchant order.
  if (
    (isLiveDemoConfirmation(checkoutText, approvalPromptActive) &&
      summaryInView) ||
    (s.receipt && checkoutReply === "approve")
  ) {
    call.pending = false;
    try {
      if (s.receipt) {
        append(
          call,
          "commentary",
          `This order is already confirmed. ${s.message}`,
          id,
        );
      } else {
        const summary = s.summary!;
        if (!summary.responseTurnId)
          throw new Error(
            "Please review the current order details before confirming.",
          );
        const result = completeLiveDemoCheckout({
          sessionId: s.sessionId,
          epoch: s.epoch,
          expectedRevision: s.revision,
          summaryId: summary.id,
          summaryRevision: summary.revision,
          responseTurnId: summary.responseTurnId,
          delegationId: `${call.callId}_${id}`,
          transcript: checkoutText,
          ...(checkoutReply === "assent"
            ? { affirmationSummaryId: summary.id }
            : {}),
        });
        call.announcedReceiptId = result.receipt.id;
        append(call, "commentary", result.snapshot.message, id);
      }
      call.error = undefined;
    } catch (error) {
      call.error =
        error instanceof Error
          ? error.message
          : "Please review the order and confirm again.";
      append(call, "commentary", call.error, id);
    }
    appendContext(call, id);
    return;
  }
  const turnId = crypto.randomUUID();
  call.turnId = turnId;
  call.pending = true;
  call.error = undefined;
  append(
    call,
    "thinking",
    "The shopping harness is checking this request. No new results or purchase are confirmed yet.",
    id,
  );
  try {
    const result = await dispatch(call, "input", {
      sessionId: s.sessionId,
      epoch: s.epoch,
      turnId,
      eventId: crypto.randomUUID(),
      baseRevision: s.revision,
      modality: "voice",
      text: checkoutReply === "approve" ? checkoutText : text,
      visibleRevision: s.revision,
      visibleProductIds: s.displayOrder,
    });
    // A correction, typed turn, or reconnect can supersede this result.
    if (
      generation !== call.generation ||
      call.closed ||
      store.core.get(s.sessionId).turn?.id !== turnId
    )
      return;
    call.pending = false;
    const content =
      (result.snapshot && spokenUpdate(result.snapshot, before.summary?.id)) ||
      "The shopping view has been updated.";
    const sent = append(call, "commentary", content, id);
    if (sent && asksForOrderApproval(content))
      approvalContext(call).arm(approvalSummary(call));
    if (result.snapshot?.receipt)
      call.announcedReceiptId = result.snapshot.receipt.id;
    appendContext(call, id);
  } catch (error) {
    const currentTurnId = store.core.get(s.sessionId).turn?.id;
    if (
      generation === call.generation &&
      !call.closed &&
      // Validation can reject the input before the route creates its new turn.
      // The prior turn still owns the unchanged summary; its rejection is not stale.
      (currentTurnId === turnId || currentTurnId === previousTurnId)
    ) {
      call.pending = false;
      call.error =
        error instanceof Error ? error.message : "Shopping work failed.";
      append(
        call,
        "commentary",
        `I couldn't complete that request. ${call.error}`,
        id,
      );
      appendContext(call, id);
    }
  } finally {
    if (generation === call.generation) call.pending = false;
  }
}
function close(call: Call) {
  call.closed = true;
  approvalContext(call).clear();
  if (calls.get(call.sessionId) === call) calls.delete(call.sessionId);
  if (call.socket.readyState === WebSocket.OPEN) {
    call.socket.send(
      JSON.stringify({ type: "session.close", event_id: crypto.randomUUID() }),
    );
    const timer = setTimeout(() => call.socket.close(), 2000);
    timer.unref();
  } else call.socket.close();
}
export async function connectGptLive(
  request: Request,
  body: Record<string, unknown> & { sessionId: string },
) {
  if (
    typeof body.sdp !== "string" ||
    !body.sdp.startsWith("v=0") ||
    body.sdp.length > 64000
  )
    throw new Error("A valid SDP offer is required.");
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI voice is not configured.");
  for (const c of calls.values())
    if (Date.now() - c.touchedAt > 15 * 60_000) close(c);
  const previous = calls.get(body.sessionId);
  if (previous) close(previous);
  if (calls.size >= 32) throw new Error("Voice is busy. Try again shortly.");
  const voice =
    typeof body.voice === "string" &&
    ["marin", "cedar", "coral"].includes(body.voice)
      ? body.voice
      : "marin";
  const response = await fetch("https://api.openai.com/v1/live/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      session: {
        model: "gpt-live-1",
        store: false,
        client: {
          data_channel: {
            allowed_client_events: [
              "session.close",
              "session.input_audio.mute",
              "session.input_audio.unmute",
            ],
          },
        },
        delegation: { type: "client" },
        instructions: LIVE_INSTRUCTIONS,
        audio: { output: { voice } },
        input: [
          {
            type: "message",
            role: "developer",
            content: [
              {
                type: "input_text",
                text: `Current verified shopping state: ${stateContext(body.sessionId)}`,
              },
            ],
          },
        ],
      },
      transport: { type: "webrtc", sdp: body.sdp },
    }),
  });
  if (!response.ok)
    throw new Error(
      `GPT-Live could not start (${response.status}). Text shopping remains available.`,
    );
  const result = await response.json();
  if (
    typeof result.session?.id !== "string" ||
    typeof result.transport?.sdp !== "string"
  )
    throw new Error("GPT-Live returned an invalid connection.");
  const socket = new WebSocket(
    `wss://api.openai.com/v1/live/sessions/${encodeURIComponent(result.session.id)}/attach`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const call: Call = {
    sessionId: body.sessionId,
    callId: result.session.id,
    socket,
    origin: new URL(request.url).origin,
    cookie: request.headers.get("cookie") ?? "",
    transcripts: new LiveTranscriptBuffer(),
    approvalContext: new LiveApprovalContext(),
    delegations: new Set(),
    generation: 0,
    delegationSequence: 0,
    contextRevision: project(body.sessionId).revision,
    contextPending: false,
    guardrails: LIVE_SHOPPING_GUARDRAILS,
    announcedReceiptId: project(body.sessionId).receipt?.id,
    pending: false,
    closed: false,
    touchedAt: Date.now(),
  };
  socket.on("message", (raw) => {
    let event: Record<string, any>;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (call.closed) return;
    if (event.type === "session.input_transcript.delta") {
      call.transcripts.add(event);
      approvalContext(call).observeInput(event);
    }
    if (event.type === "session.output_transcript.delta") {
      call.transcripts.observeOutput(event);
      approvalContext(call).observeOutput(event, approvalSummary(call));
    }
    if (
      event.type === "session.delegation.created" &&
      event.delegation?.target === "client" &&
      typeof event.delegation.id === "string" &&
      Number.isFinite(event.offset_ms)
    )
      void delegate(call, event.delegation.id, event.offset_ms);
    if (event.type === "session.closed") {
      call.closed = true;
      socket.close();
    }
    if (event.type === "error")
      call.error =
        "The live voice service reported an error. Reconnect voice if the conversation stops.";
  });
  socket.on("close", () => {
    call.closed = true;
    if (calls.get(call.sessionId) === call) calls.delete(call.sessionId);
  });
  socket.on("error", () => {
    call.error =
      "The live voice connection was lost. Text shopping remains available.";
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Voice sideband timed out.")),
        10000,
      );
      socket.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("error", () => {
        clearTimeout(timer);
        reject(new Error("Unable to attach the voice shopping harness."));
      });
    });
  } catch (error) {
    close(call);
    throw error;
  }
  calls.set(body.sessionId, call);
  getRuntime().store.core.enableLiveDemoCheckout(body.sessionId);
  approvalContext(call).expect(approvalSummary(call));
  return { sdp: result.transport.sdp, callId: call.callId };
}
function current(sessionId: string, callId: unknown) {
  const call = calls.get(sessionId);
  if (!call || call.callId !== callId || call.closed)
    throw new Error("Live voice is disconnected. Start voice again.");
  if (Date.now() - call.touchedAt > 15 * 60_000) {
    close(call);
    throw new Error("Live voice expired. Start voice again.");
  }
  call.touchedAt = Date.now();
  getRuntime().store.core.enableLiveDemoCheckout(sessionId);
  return call;
}
export function gptLiveState(sessionId: string, callId: unknown) {
  const call = current(sessionId, callId);
  const s = project(sessionId);
  approvalContext(call).expect(approvalSummary(call, s));
  if (s.receipt && call.announcedReceiptId !== s.receipt.id) {
    // Also acknowledge orders completed through text while voice stays open.
    call.announcedReceiptId = s.receipt.id;
    append(call, "commentary", s.message);
  }
  if (call.guardrails !== LIVE_SHOPPING_GUARDRAILS) {
    append(call, "instructions", LIVE_SHOPPING_GUARDRAILS);
    appendContext(call, null, s);
    call.guardrails = LIVE_SHOPPING_GUARDRAILS;
  }
  if (
    call.contextRevision !== s.revision ||
    call.contextPending !== call.pending
  ) {
    appendContext(call, null, s);
  }
  return {
    callId: call.callId,
    snapshot: s,
    pending: call.pending,
    activity: call.turnId
      ? readActivity(sessionId, s.epoch, call.turnId)
      : null,
    error: call.error,
  };
}
export async function controlGptLive(
  sessionId: string,
  callId: unknown,
  action: unknown,
) {
  const call = current(sessionId, callId);
  if (action === "stop-speaking")
    append(
      call,
      "instructions",
      "Yield only the answer the shopper interrupted. Listen to their correction, then reply after a short natural pause as soon as their thought is complete. If the correction has already finished, answer it now; do not stop a newer answer or remain silent. This is not an ongoing mute instruction. Keep pending shopping work running and answer what you can from verified context.",
    );
  else if (action === "cancel-task") {
    approvalContext(call).clear();
    call.generation++;
    call.delegationSequence++;
    if (call.pending && call.turnId) {
      const s = project(sessionId);
      await dispatch(call, "cancel", {
        sessionId,
        epoch: s.epoch,
        turnId: call.turnId,
      });
    }
    call.pending = false;
    append(
      call,
      "thinking",
      "The application cancelled the pending shopping task.",
    );
  } else if (action === "sync") appendContext(call);
  else if (action === "disconnect") {
    close(call);
    return { disconnected: true };
  } else throw new Error("Unknown live control.");
  return gptLiveState(sessionId, callId);
}
