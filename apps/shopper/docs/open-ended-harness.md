# Open-ended shopping harness

The shopper server routes each task through the OpenAI Responses API: GPT-6 Luna at none/low effort for simple and routine work, and GPT-6.1 Sol at low effort with `service_tier: "fast"` for research and recommendations involving several criteria. The model, effort, and requested processing tier stay fixed throughout each turn's tool loop. Simple offer selection stays on the lightweight route. Operator overrides remain available; see the live voice guide. The model chooses platform shopping tools in any order; ordinary conversation no longer uses the keyword/scenario router. The scripted loop remains for offline regression tests only (`NODE_ENV=test`, unless `ALONG_AGENT_MODE=live`). Provider failure is explicit and never silently falls back to scripted shopping.

[Fast mode](https://developers.openai.com/api/docs/guides/fast-mode) is a supported request option, with premium per-token pricing. It requests accelerated processing, not a guaranteed end-to-end response time: project permissions apply, and the provider can report an actual `service_tier` of `default` under ramp limits. The application does not retry failed Fast requests on a different model or tier automatically.

The model receives recent conversation and authoritative state. Catalog search, product inspection, requirements, comparison, saving, offer selection and summary preparation run through validated server tools. Product IDs, eligibility, prices and checkout state are server-owned. There are no model tools for purchase approval, payment, or external browsing. Tool results are data, not instructions. The loop has a 90-second deadline, eight model iterations, cancellation, and an output-token budget; these bound execution rather than define a shopping workflow.

Exact UI commands retain deterministic server handlers. A fresh explicit shopper confirmation is checked against the exact presented summary. Summary preparation returns canonical server speech immediately without model rewriting. Follow-up answers are separate narration, never summary playback acknowledgements. Rejected proposals cannot partially mutate state.

Order approval is routed before the general agent loop. Natural purchase requests and context-bound assent can complete the current review without another model call; “confirm” is an optional wording, not a required command. A short “yes” cannot approve a product choice or answer about returns: its pending question must refer to placing the current order. See the live voice guide for context binding and the separate no-payment sideband boundary. Preparing an identified offer's review also uses one `prepare_summary` tool call with `offerId`, retaining the same eligibility checks and final approval step.

Requirements remain editable by the shopper. The live budget guard recognizes explicit spoken amounts and corrections, including “around fifty dollars” and “from one dollar to fifty dollars,” while rejecting incidental product prices, quoted instructions and hypothetical increases. A changed deadline, minimum capacity or shoe-compartment requirement likewise needs an explicit current request. Unrelated limits remain in force. Excluding a displayed product removes it from the shortlist, order, comparison and focus in the same authoritative proposal. Validation failures are actionable limits, not temporary service outages; the agent must explain or clarify them rather than promise a retry later.

A request for a “USB microphone” describes the product connection family, not a known host port. Only a specific connector such as USB-A or USB-C belongs in `compatibility.hostConnection`. A legacy generic USB value is treated as an unknown port: products can be discovered, but connector confirmation is still required before checkout. Explicit incompatibility remains a hard limit.

Catalog search is paginated. Quote results report budget fit separately from checkout eligibility: an unknown connector can block checkout while a product still fits the budget and can be shown for consideration. The agent must continue through relevant pages before claiming that the catalog lacks a match, and must not substitute a different requested format simply because it is cheaper on the first page. The existing iteration and timeout bounds still apply; exhausted work must be described as incomplete rather than an exhaustive no-match result.

Voice uses GPT-Live for continuous conversation with client delegation to this same shopping harness. Speech interruption leaves pending work running; new constraints supersede obsolete work. The server sideband owns tool dispatch and verified context. GPT-Live transcript fragments do not satisfy strict spoken-approval evidence; the no-payment prototype has a separate server-only confirmation path bound to the reviewed order. See [live voice](live-voice.md) for its limits.

## Test rehearsal

1. Ask: “I need a bag for work and the gym under 150 dollars.”
2. Say: “Capacity matters most. I carry a laptop and gym clothes.”
3. Ask: “Why would I pick the first one instead of the second?”
4. Change a preference or budget; confirm the earlier requirements remain relevant.
5. Inspect an offer, review the simulated purchase summary, ask a follow-up, then deliberately confirm only if desired.
6. Interrupt while thinking or speech is loading. Old output must not overwrite the new turn.

The platform currently contains a curated catalog and simulated offers, not live stock or real ordering. No browser microphone end-to-end automation should be mistaken for a human listening test.
