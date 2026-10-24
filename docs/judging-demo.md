# Along: judging evidence and demo

## Product thesis

**From “I noticed that” to “will it work for me?” in one conversation.** Along is a voice shopping agent with an optional Chrome companion. The companion can notice a product on an enabled public page, offer a quiet nudge, and carry the inspiration into the shopper’s existing conversation. Along then evaluates it against accepted needs, identifies missing evidence, and helps the shopper decide.

The differentiator is context continuity: noticing a bag is useful; remembering the shopper’s budget, laptop and delivery requirements and explaining the trade-offs makes it a shopping experience. Recognition alone does not establish exact identity, fit or a purchasable offer.

This document maps the prototype to the supplied challenge slides. The slides’ voice, vision and personalized-content examples are inspiration, not an assertion that all three are required deliverables. Generated try-on or personalized video is not implemented.

## Answers to the three challenge questions

| Question | Along’s answer | Evidence and boundary |
| --- | --- | --- |
| Is it effortless? | After one-time pairing and per-site consent, discovery starts from ordinary browsing. No pasted URL is needed. One “Discuss with Along” action continues the existing conversation. | Focus, dwell, deduplication and cooldown gate nudges. Drafts, active voice work and order review delay imports. Unsupported layouts remain quiet; it does not scan every website. |
| Does context compound? | The discovery joins the same session, requirements and history. Its fit assessment separates matches, conflicts and unknowns, with catalog alternatives where grounded evidence is available. | `DiscoveryAssessment`, the read-only `inspect_discovery` tool, shared session projection and live voice context. Currency differences and missing dimensions remain unknown. This is session continuity, not durable cross-device memory. |
| Can customers stay in control? | Site consent, separate visual consent, pause, clear, disconnect, explicit catalog return and an approval boundary remain available. | External references cannot select or purchase a hidden catalog item. Checkout in Along is simulated. Opening Coupang lets the customer inspect and purchase there themselves. |

## Five judging dimensions

| Dimension | Demonstrate | Do not overclaim |
| --- | --- | --- |
| AI-first transformation | A real media crop becomes product context, then enters the same voice/text agent; a follow-up changes the evaluation. | An automatic product nudge is not proof of every-object recognition or universal browsing support. |
| Customer value and experience | Keep the shopper’s requirements, expose a fit problem or missing measurement, compare full demo totals, and let them decline. | A marketplace item price is not a delivered total or a promise of availability. |
| Innovation and differentiation | Move from incidental inspiration to a grounded decision without restarting or re-describing the product. | Do not pitch the extension as a separate replacement for the voice agent. |
| Execution and feasibility | Show one uninterrupted journey and the automated regression evidence. Explain the provider fallback and the current deployment boundary. | Local fixtures, mocked provider tests and live website rehearsals are different evidence. In-memory state requires one process. |
| Responsible AI and safety | Show the source, “not verified” checks, explicit demo labels, pause and the distinction between a discovery and an order. | Do not call approximate recognition an exact match, or fixture seller offers live Coupang inventory. |

## Seven-minute presentation

1. **0:00–0:40 — Problem.** “Shopping inspiration happens outside a shopping app. The hard part is turning that moment into a choice that fits your needs.” State the product thesis.
2. **0:40–1:25 — Establish context.** In Along: “I need a work and gym bag under USD 150.” Add the actual laptop measurements if demonstrating fit. Use voice if rehearsed; text remains an accessible fallback.
3. **1:25–2:30 — Incidental discovery.** Visit the rehearsed YouTube or Amazon page with the companion already paired and that site enabled. Let the natural nudge appear. Show its possible-match/search label. Open the side panel.
4. **2:30–3:50 — Context compounds.** Choose “Discuss with Along.” Point out that it is the same session. Ask “How does this fit my requirements?” Show the known facts, explicit unknowns and the next useful question. A listing with no dimensions should stay unknown.
5. **3:50–4:50 — Evaluate and choose.** Inspect source-backed evidence or clearly labelled demo catalog alternatives. Change one requirement and show the assessment update. Explain why the total, compatibility or measurement changes the decision.
6. **4:50–5:35 — Purchase boundary.** Open the Coupang search/listing for external discovery. If Coupang access is blocked, say so. Separately, return to the demo catalog, review its complete order and explicitly confirm a simulated purchase. Never present these as one real transaction.
7. **5:35–6:20 — Control and feasibility.** Pause the companion, explain consent/cropping, bounded provider calls, single-process storage and the approved API integration path.
8. **6:20–7:00 — Answers and close.** “Effortless: ordinary browsing. Intelligent: your context follows the discovery. Trusted: facts, unknowns and the decision stay visible.” Leave time for one question.

Keep a local `/extension-demo` fixture as a disclosed fallback. If it is used, call it a controlled fixture at the moment of switching. Rehearse microphone permissions, model access, site login state and retailer accessibility on the presentation machine.

## Live platform evidence

Evidence from this development session, before the final integration regression pass:

| Surface | Observed result |
| --- | --- |
| YouTube desktop watch page | Automatic nudge, cropped visual recognition of an Osprey Daylite TotePack, Korean search suggestion and same-session handoff observed. |
| Amazon Singapore product page | Automatic nudge and Sony WH-1000XM4 product context/search suggestion observed. |
| Coupang destination | Search URL opened; retailer returned an access restriction. Search-result inventory, seller offers and purchase were not validated. |
| Amazon US | Page reached an interstitial; end-to-end discovery not completed. |
| Instagram, TikTok, YouTube Shorts | Adapters and controlled media fixtures exist. Live end-to-end tests remain outstanding. |
| Arbitrary websites and native mobile apps | Not supported. |

Therefore, do not claim “tested on all platforms” or “production-ready.” Automated browser regressions verify the installed extension scripts against a controlled local page; they do not certify current third-party layouts or real acoustic voice quality.

## API and commercial questions

- **How can this work without Coupang Partners access?** Recognize product context, generate an ordinary Coupang search link, and optionally retrieve source-backed public product URLs. No current prices, stock or delivery guarantees are fabricated.
- **What does approved API access add?** The existing adapter can use authorized Partners search results. Actual account eligibility, endpoint availability, placement permissions and quotas need an approved live rehearsal. Setting an environment flag does not obtain approval.
- **Does Along buy automatically?** No. Along’s catalog checkout is a simulation. Real external purchases happen on Coupang under the user’s control.
- **What is sent for visual discovery?** After opt-in, a bounded crop of visible media and selected public page context go to the configured Along server/provider. Audio is not captured by the companion. The original viewport screenshot is not uploaded or retained by Along.
- **Why not add more features before the demo?** A coherent discovery-to-decision journey, visible uncertainty and reliable voice handoff are more valuable than an unrehearsed try-on or a promise of universal site support.

See [extension setup and boundaries](extension.md), [live voice](../apps/shopper/docs/live-voice.md), [the shopping harness](../apps/shopper/docs/open-ended-harness.md), and the PR’s validation results for implementation evidence.

## Media matched to seeded products

Use **BAG-001** for the main story. Osprey’s [Daylite Large Tote Pack product tour](https://www.youtube.com/watch?v=AVs7Do3J64I) corresponds to the seeded 26 L bag with a nominal 16-inch laptop sleeve and bottom shoe section. The [manufacturer product page](https://www.osprey.com/daylitetm-large-tote-pack) supports that model identity. The video’s pictured color is not a verified match to a synthetic seller variant.

Backup: **BAG-002**, Osprey’s [Daylite Tote Pack product tour](https://www.youtube.com/watch?v=0S89xGN-SO8), corresponds to the separate 20 L model. Do not substitute its 14-inch nominal laptop specification for BAG-001’s. Official video metadata was found during research; live playback must still be rehearsed in Chrome.

For the coherent seeded-data demonstration:

1. Start Along and state “a work and gym bag, budget USD 150.”
2. Pair the Chrome companion, enable YouTube, and explicitly enable **Demo mode**.
3. Open the BAG-001 video and wait for its public title to settle. These two manufacturer tours are explicitly mapped to their seeded models for the demo; other demo pages use title/caption words. This is not video-pixel recognition, and that distinction should be stated.
4. Select the **Daylite Large Tote Pack** candidate and choose **Discuss with Along**. Confirm the same session, requirements and catalog photograph.
5. Inspect the fit checks, then choose **Explore this demo product**. This explicit action opens the exact seeded ID without approving anything.
6. Ask for offers, choose an offer, inspect the full order summary and explicitly confirm. The resulting receipt is **simulated**.
7. For the real retailer path, open **Search on Coupang** from the reference card. Availability and completion of a real purchase require retailer access and the customer’s actions there; the generated search is not proof that this exact model is stocked.

The local `/extension-demo` fallback now shows BAG-001’s source-attributed photograph rather than an unrelated illustration. It is labelled a prepared page, and it exercises the same installed extension, handoff, exact-product transition and simulated checkout path.
