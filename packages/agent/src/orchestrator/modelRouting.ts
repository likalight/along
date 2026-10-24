import type { SessionSnapshot } from "@coupang/contract";

export type ShoppingReasoningEffort =
  "none" | "low" | "medium" | "high" | "xhigh" | "max";
export type ShoppingServiceTier = "auto" | "default" | "fast" | "priority";
export interface ShoppingModelRoute {
  model: string;
  reasoningEffort: ShoppingReasoningEffort;
  serviceTier?: ShoppingServiceTier;
  task: "simple" | "routine" | "constrained" | "research" | "override";
}

/** Routing changes inference cost, never the available tools or purchase authority.
 * Deliberately conservative: ambiguous requests stay at low effort; no extra
 * classification call, and no old research request permanently raises routing.
 */
export function routeShoppingModel(
  text: string,
  snapshot: Pick<SessionSnapshot, "hardConstraints" | "preferences">,
  override: {
    model?: string;
    reasoningEffort?: ShoppingReasoningEffort;
    serviceTier?: ShoppingServiceTier;
  } = {},
): ShoppingModelRoute {
  if (override.model)
    return {
      model: override.model,
      reasoningEffort: override.reasoningEffort ?? "low",
      ...(override.serviceTier ? { serviceTier: override.serviceTier } : {}),
      task: "override",
    };
  const request = text.toLowerCase();
  // Selecting a known option is not a fresh multi-criteria recommendation,
  // even after the conversation has accumulated many remembered preferences.
  const checkoutChoice =
    /^(?:(?:ok(?:ay)?|yes|yeah|please)[,.!]?\s+)*(?:(?:let['’]?s\s+)?(?:continue|proceed|go (?:ahead|with))\b|(?:choose|select|review|buy|take)\s+(?:(?:this|that|the)\s+)?(?:one|offer|option)\b)/.test(request) &&
    !/\b(compare|between|versus|which|whether|recommend|best|trade.?offs?|cheaper|better|by price|by quality)\b/.test(request);
  const research =
    /\b(research|investigate|difficult tradeoffs?|complex tradeoffs?|long.term cost|total cost of ownership|conflicting requirements)\b/.test(
      request,
    );
  const comparison =
    /\b(compare|comparison|trade.?offs?|weigh|balance|versus|vs\.?|which|recommend(?:ations?)?|best|choose)\b/.test(
      request,
    );
  const criteria = [
    /\b(budget|price|cost|cheap|affordable|under|below)\b/,
    /\b(capacity|litres?|liters?|roomy|storage)\b/,
    /\b(weight|lightweight|heavy|portable)\b/,
    /\b(size|compact|dimensions|fit)\b/,
    /\b(durable|durability|waterproof|quality)\b/,
    /\b(delivery|shipping|arrive|available|stock)\b/,
    /\b(noise|isolation|microphone|calls|battery|wireless)\b/,
    /\b(colou?r|black|white|blue|red|green)\b/,
  ].filter((pattern) => pattern.test(request)).length;
  const remembered = new Set([
    ...Object.keys(snapshot.hardConstraints),
    ...Object.keys(snapshot.preferences),
  ]).size;
  const complexity = Math.max(criteria, remembered);
  let route: ShoppingModelRoute;
  if (research)
    route = {
      model: "gpt-6.1-sol",
      reasoningEffort: "low",
      serviceTier: "fast",
      task: "research",
    };
  else if (checkoutChoice)
    route = { model: "gpt-6-luna", reasoningEffort: "none", task: "simple" };
  else if (comparison && complexity >= 3)
    route = {
      model: "gpt-6.1-sol",
      reasoningEffort: "low",
      serviceTier: "fast",
      task: "constrained",
    };
  else if (
    !comparison &&
    /\b(filter|sort|only show|show only|my budget|i prefer|i want|must have|exclude|remove|remember|under|below)\b/.test(
      request,
    )
  )
    route = {
      model: "gpt-6-luna",
      reasoningEffort: "none",
      task: "simple",
    };
  else route = { model: "gpt-6-luna", reasoningEffort: "low", task: "routine" };
  // Effort-only overrides are intended for operator tuning of automatic routes.
  if (override.reasoningEffort) {
    route.reasoningEffort =
      route.model === "gpt-6.1-sol" && override.reasoningEffort === "none"
        ? "low"
        : override.reasoningEffort;
  }
  if (override.serviceTier) route.serviceTier = override.serviceTier;
  return route;
}
