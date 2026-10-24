# Checkout conversation contract

Behavior for the current Along demo, based on the final sections of the [enhanced agent contract](https://chatgpt.com/s/cx_6add23b2f9988191bb4e8c980b01580d) and the shopper feedback on 25 October 2026.

- Recommend a useful direction and advance in the same turn. Ask one focused question only if it changes the next useful action; use reversible assumptions or comparisons for optional details.
- A clear product purchase request goes straight to review. Choose its lowest complete-cost eligible offer automatically unless an unresolved delivery, returns or seller tradeoff matters. Do not ask permission to prepare the order.
- Carry the intent to buy through clarifications. A shopper saying they have a dongle or will handle ordinary USB cabling settles that detail for the chosen product. Do not demand connector names, model numbers or repeated reassurance. Record this separately from verified connector facts; retract it if the shopper changes their answer. This allowance applies only to the demo's proxy offers, not real offers or unrelated incompatibilities.
- Keep firm budgets, exclusions, pricing, required hardware, stock and other eligibility checks. Explain an actual remaining blocker once and resolve it without restarting discovery.
- Present the exact order on screen and give a compact spoken review of the product, variant, seller, quantity, complete total, delivery and material terms. Existing UI wording preferences remain in force; this change does not reintroduce the shared draft's demo-disclosure copy.
- Obtain one fresh authorization for that review. A request before review prepares it; a valid request after review can complete it. Setup reassurance is not purchase authorization. An unchanged review survives follow-up questions and interruption; changed purchase terms require a new review and authorization. Keep the server's channel-specific presentation rules.
- The server completes the purchase. On an uncertain completion result, check its current receipt before proposing a retry. Do not submit again or claim success without the matching receipt.

## Acceptance examples

1. “I want the RØDE. I've got a dongle, no worries.” → Record shopper-managed setup for that product and prepare its lowest-cost eligible offer, without naming a host port or placing an order.
2. “Actually I don't have the adapter.” → Retract the setup answer and resolve the missing connection; do not keep an invalid review active.
3. “I have the adapter” with a $50 firm limit and a $119 offer → Preserve the budget and explain the price mismatch. Cabling reassurance cannot waive it.
4. Choose a different product → Do not transfer product-specific setup reassurance automatically.
5. “What's the return policy?” while reviewing → Answer while preserving the unchanged order review. Do not ask to restart checkout.
6. An order commits but its acknowledgement fails → Return the matching authoritative receipt without a second completion attempt.

Implementation: shopping tool descriptions and the research/voice prompts govern conversation; the authoritative store and quote checks govern accepted state. Tests cover the setup acknowledgement, product-specific scope, revocation, complete-cost offer choice and receipt recovery.
