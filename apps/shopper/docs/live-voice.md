# GPT-Live shopping demo

The shopper uses `gpt-live-1` over WebRTC for continuous conversation. The browser sends microphone audio and plays the provider's audio track. An authenticated server sideband receives transcript fragments and delegation events, then runs the existing shopping harness. The React Bits carousel reads the same authoritative shopping snapshot as text mode.

## Start and test

Keep `OPENAI_API_KEY` in the ignored `apps/shopper/.env.local`. Never expose it with a NEXT_PUBLIC variable. Build contract and agent before shopper:

```sh
npm run build -w @coupang/contract
npm run build -w @coupang/agent
npm run build -w @along/shopper
env -u OPENAI_API_KEY npm run start -w @along/shopper -- --port 4323
```

Open http://127.0.0.1:4323 and choose **Start talking**. Allow the microphone. Model availability checks do not start a call; a call begins only after the user chooses voice. Marin is the default; changing voices requires a new provider session.

Try:

1. “People have trouble hearing me on video calls. I don't know what kind of microphone I need.” Along should ask a useful contextual question and explain the relevant tradeoff conversationally, without reciting every microphone type.
2. Discuss a direction, or request a visual comparison and choose by name, numbered position, or its button. The subsequent product shortlist should follow that choice. Compact visual choices are optional; a clear need can move directly to recommendations.
3. Listen as Along discusses each product by its displayed name. The carousel should follow the current product without selecting an offer.
4. Interrupt an explanation. Local playback should yield while the microphone and useful shopping work stay active. Speak a correction, then check that a fresh reply is audible and its product focus follows the new speech.
5. “Show the next one.” Explicit navigation still changes accepted focus. “Actually, keep it below 80 dollars” must supersede older shopping work.
6. Ask for offers and review the displayed order. Try “Yes, go ahead and place the order,” or answer its order-approval question with “yes please.” No special confirmation word is required. The order should stay in checkout until accepted, then show an animated green check, receipt, and delivery estimate. Voice should affirm that accepted receipt once. Text confirmation remains available.

## Purchase boundary

GPT-Live transcript deltas do not provide the finality and confidence evidence required by the strict spoken-purchase approval guard. They are never promoted to trusted approval evidence. This no-payment demo uses a separate, server-only `completeLiveDemoCheckout` path for explicit confirmation observed on the authenticated provider sideband. It binds the delegation to the current displayed summary, revision, response turn and still-eligible proxy offer, then issues only a receipt marked `simulated: true` and `completionSource: live_demo`. It cannot authorize a payment or merchant order, is not exposed as an HTTP action/model tool, and cannot be replayed through strict approval. Original final/non-echo/confidence checks remain unchanged for verified voice approval. A rejected confirmation leaves the summary intact.

Shopping work passes through the authenticated session route and authoritative store. The conversational model cannot confirm on the shopper's behalf or mark a summary as heard. Prices, offers, selection, summary versions, and receipts remain server-controlled. Customer-facing language omits rehearsal terminology; underlying catalog provenance and receipt markers remain intact. Delivery wording comes from the accepted order, never an invented shipment event or one-day promise.

Checkout intent is checked before general shopping input can invalidate the review. The shared whole-utterance classifier distinguishes clear purchase requests, short assent, and other conversation. Clear requests such as “please buy it” still require the current displayed order. Short assent additionally requires a pending order-approval question bound to that summary's ID, revision and response turn. The Live sideband consumes this context per delegated reply and clears it for an unrelated question; individual transcript fragments never count as complete approval. Unbound assent asks one direct order question while retaining the review. Negation, changes, quotations and hypothetical statements are not purchase approval. Typed assent is limited to the freshly displayed order question; a later discussion cannot reuse that context. The verified voice path retains its original finality, non-echo, confidence and playback requirements.

## Delegation and interruptions

The server selects client delegation so the existing open-ended agent, tools, and guardrails remain in use. Provider timestamps associate transcript fragments with a delegated request. Buffered text reaching the delegation timestamp takes a 50ms fast path. Otherwise fragments settle for 150ms without consuming the prefix, capped at 350ms total, so a trailing budget amount can join its request. Missing transcripts receive bounded retries. These are transport heuristics, not proof of utterance completion: the delegation timestamp can follow speech and transcript delivery is uneven. Browser captions are display-only. Corrections supersede older work; stale results cannot publish new narration over a newer turn. A clarification that changes a budget or preference must be delegated, even when phrased briefly as “around fifty dollars.” Stopping speech is separate from cancelling a task. Typed requests cancel pending voice work before entering the normal text path.

The microphone remains active during backend work and assistant speech. The browser samples input and output levels locally and mutes playback after 200ms of sustained input over its ambient/echo threshold, then asks the provider to yield only the interrupted answer and resume after the shopper's correction. The output stream continues silently so queued speech can drain. The gate remembers a reply that begins during its 100ms local end pause or while the stop request is pending, then releases it once both conditions are satisfied. A caption timestamped after the shopper's correction can qualify with a 50ms remote audio gap; without that timestamp the gate retains a 120ms gap plus fresh text, or a 600ms gap without text. Buffered captions enter the carousel matcher only when playback resumes. Audio drained while muted is not replayed. Manual stop stays silent until new shopper input.

These are playback heuristics: GPT-Live supplies no output-turn completion event, so they cannot prove that a resumed segment is a new answer. They never establish transcription finality or purchase authorization. Delayed transcript fragments cannot interrupt a newer answer or reset the recovery clock. Brief acknowledgments are allowed; a clear short correction can interrupt earlier when supported by recent microphone activity. Echo cancellation is requested, but acoustic quality, false triggers, and real interruption timing still require a human microphone/speaker test. Sideband loss or provider errors are surfaced rather than silently pretending the old transcription/TTS adapter is GPT-Live.

Recoverable shopping limits and rejected actions are sent as spoken commentary, with a usable next step. Rejections before input ingestion still belong to the unchanged prior turn and must not be discarded as stale. Completed or rejected work clears its pending flag before sending updated voice context. Missing input asks for repetition aloud without cancelling an existing task. None of these paths closes a healthy voice connection or overrides manual mute, and sending commentary does not itself prove that it was heard.

## Product focus during live speech

Live assistant captions match distinctive names or explicit option numbers only against the accepted visible products. This drives presentation focus without changing the shortlist, offer selection, or purchase state. Short pauses retain the current product. Interruptions and new accepted revisions clear the speech focus; ambiguous names and generic pronouns do not guess a product. This follows provider transcript timing rather than claiming word-accurate audio alignment.

## Model routing

The same agent loop selects a backend model once per turn; this does not add a workflow graph or change tool permissions.

| Task | Model | Reasoning effort | Requested processing tier |
| --- | --- | --- | --- |
| Simple filters/preferences and known-offer checkout | gpt-6-luna | none | Project default |
| Routine recommendations/comparisons | gpt-6-luna | low | Project default |
| Recommendations/comparisons with several criteria | gpt-6.1-sol | low | fast |
| Explicit research/difficult tradeoffs | gpt-6.1-sol | low | fast |

Routing is a lightweight heuristic using the current request and accepted preferences. It should be evaluated on real shopping requests, not treated as a guarantee of difficulty. Model, reasoning effort, and requested service tier are chosen once per turn and retained across tool calls. Optional `ALONG_AGENT_MODEL`, `ALONG_AGENT_REASONING_EFFORT`, and `ALONG_AGENT_SERVICE_TIER` override automatic routing for operator testing. Supported tier overrides are `auto`, `default`, `fast`, and `priority`; `priority` is the documented Fast-mode alias. An explicit model override retains its existing effort behavior and only requests a tier when the tier override is also set.

[GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) supports low reasoning effort. [Fast mode](https://developers.openai.com/api/docs/guides/fast-mode) uses the Responses API's `service_tier` field and has premium per-token pricing. The returned tier indicates actual provider processing; the provider can downgrade to `default` under ramp limits, and project permissions may reject a tier. Request-body regression tests verify configuration, not account eligibility or measured live latency. There is no automatic model or service-tier fallback on provider errors.

## References

- [GPT-Live prompting](https://developers.openai.com/api/docs/guides/live-prompting)
- [Delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation)
- [WebRTC connection](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live)
- [Session events](https://developers.openai.com/api/docs/guides/live-conversations)

The prior Realtime transcription plus TTS implementation remains in source for its existing evidence tests. It is not the configured GPT-Live conversation adapter.
