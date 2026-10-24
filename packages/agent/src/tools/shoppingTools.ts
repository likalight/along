import { z } from "zod";
import { normalizeHostConnection } from "@concierge/backend/along-catalog";
import type {
  AgentProposal,
  InputEvent,
  SessionSnapshot,
  SpeakableResult,
} from "@coupang/contract";
import {
  EVIDENCE,
  getProduct,
  getOffer,
  PRODUCTS,
  OFFERS,
} from "../fixtures/catalog.js";
import { AuthoritativeSessionStore } from "../session/AuthoritativeSessionStore.js";
import type { FixtureSessionStore } from "../session/FixtureSessionStore.js";
import type { SessionThread } from "../thread/SessionThread.js";
import { reduce } from "../thread/reduce.js";
import { parseBudgetUpdate } from "../intent/requirements.js";
import {
  allowsCapacityReduction,
  allowsDeliveryExtension,
  allowsRemovingShoeCompartment,
} from "../intent/criteriaUpdates.js";

const usbConnector = "usb[- ]?(?:type[- ]?)?[ac]";
const usbPath = new RegExp(`(${usbConnector})\\s*(?:-?to-?|→|/)\\s*(${usbConnector})`, "i");

/** Adapter ends describe a path, not which port is on the shopper's computer. */
function adapterContext(text: string) {
  const mentionsHardware = /\b(?:adapter|adaptor|dongle|cable)\b/i.test(text);
  // Scope uncertainty to each sentence/clause. "I want to buy it" must not
  // erase a separate factual answer about the computer or an owned adapter.
  const unquoted = text.replace(/["“][^"”]*["”]|(?:^|\s)'[^']+'(?=\s|$)/g, " ");
  const clauses = (unquoted.match(/[^.!?;\n]+[.!?;]?/g) ?? []).flatMap((sentence) =>
    /[?"“”]|\b(?:if|unless|maybe|perhaps|suppose|hypothetically)\b/i.test(sentence)
      ? [] : sentence.split(/\s+(?:and|but)\s+/i),
  );
  let host: string | undefined, pathLabel: string | undefined, ownsAdapter = false;
  for (const clause of clauses) {
    if (/\b(?:don't|do not|not|never|haven't|have not|need|want|looking for)\b/i.test(clause)) continue;
    const statedHost = clause.match(new RegExp(
      `\\b(?:(?:my|the) (?:laptop|computer|macbook|pc) (?:has|uses|takes|supports)|i use) (?:a |an |only )?(${usbConnector})(?![- ]*to\\b|\\s+(?:adapter|adaptor|dongle|cable)\\b)\\b`, "i",
    ))?.[1];
    if (statedHost) host = statedHost;
    const path = clause.match(usbPath);
    if (path && /\b(?:adapter|adaptor|dongle|cable)\b/i.test(clause)) {
      pathLabel = `${normalizeHostConnection(path[1])} to ${normalizeHostConnection(path[2])}`;
      ownsAdapter = /\b(?:i (?:do )?have|i own|my (?:usb|adapter|adaptor|dongle|cable))\b/i.test(clause);
    }
  }
  return { mentionsHardware, host, pathLabel, ownsAdapter };
}

type Field = { schema: z.ZodTypeAny; json: Record<string, unknown> };
const string = (description = ""): Field => ({
  schema: z.string().max(2000),
  json: { type: "string", description },
});
const boolean: Field = { schema: z.boolean(), json: { type: "boolean" } };
const number: Field = {
  schema: z.number().nonnegative().finite(),
  json: { type: "number", minimum: 0 },
};
const nullable = (f: Field): Field => ({
  schema: f.schema.nullable(),
  json: { anyOf: [f.json, { type: "null" }] },
});
const enumeration = (values: [string, ...string[]]): Field => ({
  schema: z.enum(values),
  json: { type: "string", enum: values },
});
const array = (f: Field): Field => ({
  schema: z.array(f.schema).max(30),
  json: { type: "array", items: f.json, maxItems: 30 },
});
const object = (fields: Record<string, Field>): Field => ({
  schema: z
    .object(
      Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.schema])),
    )
    .strict(),
  json: {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v.json]),
    ),
    required: Object.keys(fields),
    additionalProperties: false,
  },
});
const id = string(
  "Exact platform ID returned by catalog tools; never invent IDs.",
);
const product = { productId: id };
const definitions = {
  show_solution_types: {
    description:
      "Optionally show a compact microphone setup chooser: 1 headset, 2 lavalier/clip-on, 3 desk mic. Use only when seeing these alternatives would help the current conversation, especially if the shopper asks to compare kinds. Do not open it automatically for every audio problem or for desk-stand/boom-arm details. Prefer one natural question about the shopper's situation and discuss only relevant tradeoffs. Once shown, wait for their choice or their request to move on before replacing it with products.",
    fields: { question: string("One useful question to help the shopper choose a microphone direction.") },
  },
  choose_solution_type: {
    description:
      "Remember a microphone direction agreed in conversation; no visual chooser is required. Use headset, clip_on (lavalier), or directional_desktop; use any when the shopper asks to move on without choosing a kind or to see products across kinds. Never treat your own suggestion as the shopper's decision. An informed request for a specific kind may use this directly. Do not ask for buying priority or an optional budget before showing products.",
    fields: { solutionType: enumeration(["headset", "clip_on", "directional_desktop", "any"]) },
  },
  search_catalog: {
    description:
      "Browse up to 12 platform products with authoritative offer eligibility. eligible means ready for checkout, not whether the price fits: inspect budgetStatus and conflicts separately. An unknown host connector permits product discovery while checkout waits. Category filters the pool; query ranks matches, including exact IDs, before other category products. Start with offset null, then use nextOffset with the same category/query to see more. totalProducts is the complete filtered pool, not just this page; do not report no matching products based only on this page. Inspect a product for full details. Offers and explicitly marked demo reviews are simulated.",
    fields: {
      category: nullable(enumeration(["audio", "bags", "bedding"])),
      query: nullable(string()),
      offset: {
        schema: z.number().int().min(0).max(100000).nullable().default(null),
        json: { anyOf: [{ type: "integer", minimum: 0, maximum: 100000 }, { type: "null" }] },
      },
    },
  },
  inspect_product: {
    description:
      "Read exact product facts, evidence, and current authoritative offer quotes. Unknown facts remain unknown.",
    fields: product,
  },
  remember_requirements: {
    description:
      "Remember only shopper-stated needs and preferences. Null means leave unchanged. Existing hard requirements and exclusions are preserved. Apply a clear budget correction in this same turn, before searching or shortlisting. budgetMinor is integer cents: fifty dollars is 5000. Budget increases require the shopper to explicitly state the new amount this turn; spoken number words are valid.",
    fields: {
      needs: array(string()),
      preferences: array(object({ key: string(), value: string() })),
      exclusions: array(id),
      minimumCapacityL: nullable(number),
      separateShoeCompartment: nullable(boolean),
      budgetMinor: nullable(number),
      category: nullable(enumeration(["audio", "bags", "bedding"])),
      maxDeliveryDays: nullable(number),
      compatibility: object({
        hostConnection: nullable(string("Only the shopper's specific computer connector, such as usb-a or usb-c. Adapter/cable ends such as USB-A to USB-C are a connection path, not the host connector: leave unchanged and remember the explicit path in preferences. Generic USB is an interface family, not a connector. Never infer a port from an unspecified dongle or the first end of an adapter.")),
        laptopInches: nullable(number),
        bedWidthInches: nullable(number),
        bedLengthInches: nullable(number),
        mattressDepthInches: nullable(number),
      }),
    },
  },
  set_priority: {
    description:
      "Remember how the shopper wants tradeoffs ranked; never removes a hard budget.",
    fields: {
      priority: enumeration([
        "best_value",
        "best_supported_quality",
        "lowest_cost_suitable",
      ]),
    },
  },
  shortlist: {
    description:
      "Show up to five catalog products in the supplied order, with truthful concise fit reasons and compromises. Server filters against requirements; inspect returned snapshot to see what was actually shown.",
    fields: {
      entries: array(
        object({ productId: id, fitReason: string(), compromise: string() }),
      ),
    },
  },
  compare: {
    description: "Show comparison of two to four currently visible products.",
    fields: { productIds: array(id) },
  },
  navigate_products: {
    description:
      "Move the product carousel without changing its order or requirements. Next and previous wrap around. Position is one-based in the current display order; use null unless direction is position. Never selects an offer or purchases.",
    fields: {
      direction: enumeration(["next", "previous", "first", "last", "position"]),
      position: nullable({
        schema: z.number().int().min(1).max(5),
        json: { type: "integer", minimum: 1, maximum: 5 },
      }),
    },
  },
  focus: { description: "Focus a currently visible product.", fields: product },
  show_evidence: {
    description:
      "Show verified catalog evidence IDs, separate product and seller evidence.",
    fields: { evidenceIds: array(id) },
  },
  save: {
    description: "Save an exact catalog product for later, without purchasing.",
    fields: { ...product, rationale: string() },
  },
  restore: {
    description:
      "Restore a previously saved product and recheck its eligibility.",
    fields: product,
  },
  select_offer: {
    description:
      "Select an eligible simulated platform offer. Server rejects incompatible, over-budget, or otherwise ineligible offers. Does not purchase.",
    fields: { offerId: id },
  },
  prepare_summary: {
    description:
      "Prepare the server's exact purchase review when the shopper wants to proceed. Pass an exact offerId to validate and select that offer and prepare its review in this single call; use null to review the already selected offer. This ends the turn with the exact server text. Never approves or purchases.",
    fields: { offerId: { ...nullable(id), schema: id.schema.nullable().default(null) } },
  },
} satisfies Record<
  string,
  { description: string; fields: Record<string, Field> }
>;

export const shoppingTools = Object.entries(definitions).map(([name, def]) => ({
  type: "function" as const,
  name,
  description: def.description,
  strict: true,
  parameters: object(def.fields).json,
}));
export interface ShoppingToolResult {
  ok: boolean;
  data?: unknown;
  reason?: string;
  snapshot: SessionSnapshot;
  speakable?: SpeakableResult;
  canonicalSummary?: boolean;
  proposal?: AgentProposal;
}

export type ProductNavigation = {
  direction: "next" | "previous" | "first" | "last" | "position";
  position: number | null;
};

/** Display order is stable: rotation only changes focus, never ordinal identity. */
export function resolveProductNavigation(
  snapshot: SessionSnapshot,
  navigation: ProductNavigation,
): string {
  const ids = snapshot.displayOrder.filter((id) =>
    snapshot.shortlistIds.includes(id),
  );
  if (!ids.length)
    throw new Error(
      "There aren’t any products to browse yet. Tell me what you’re looking for.",
    );
  if (navigation.direction === "position") {
    if (
      !Number.isInteger(navigation.position) ||
      navigation.position! < 1 ||
      navigation.position! > ids.length
    )
      throw new Error(
        `There are only ${ids.length} products in these choices.`,
      );
    return ids[navigation.position! - 1]!;
  }
  if (navigation.position !== null)
    throw new Error("Position is only valid for numbered navigation.");
  if (navigation.direction === "first") return ids[0]!;
  if (navigation.direction === "last") return ids[ids.length - 1]!;
  const index = ids.indexOf(snapshot.focusedProductId ?? ids[0]!);
  const current = index < 0 ? 0 : index;
  return ids[
    (current + (navigation.direction === "next" ? 1 : -1) + ids.length) %
      ids.length
  ]!;
}

/** Only unambiguous, standalone movement commands bypass model reasoning. */
export function parseProductNavigation(text: string): ProductNavigation | null {
  const command = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/^please\s+/, "")
    .replace(/,?\s+please$/, "");
  if (
    /^(?:(?:show(?: me)?|go to|move to) (?:the )?)?next(?: (?:one|product|option|bag|card))?$/.test(
      command,
    )
  )
    return { direction: "next", position: null };
  if (
    /^(?:go back|(?:(?:show(?: me)?|go to|move to) (?:the )?)?previous(?: (?:one|product|option|bag|card))?)$/.test(
      command,
    )
  )
    return { direction: "previous", position: null };
  const ordinal = command.match(
    /^(?:(?:show(?: me)?|go to|focus on) (?:the )?)(first|second|third|fourth|fifth|last)(?: (?:one|product|option|bag|card))?$/,
  );
  if (!ordinal) return null;
  if (ordinal[1] === "last") return { direction: "last", position: null };
  return {
    direction: "position",
    position:
      ["first", "second", "third", "fourth", "fifth"].indexOf(ordinal[1]!) + 1,
  };
}

/** Model arguments never supply identity, revision, consent, or a transaction endpoint. */
export function executeShoppingTool(opts: {
  name: string;
  arguments: unknown;
  input: InputEvent;
  store: FixtureSessionStore;
  thread: SessionThread;
}): ShoppingToolResult {
  const { name, input, store, thread } = opts;
  const snapshot = store.get(input.sessionId) ?? thread.snapshot;
  reduce(thread, {
    type: "tool_call",
    data: { turnId: input.turnId, intent: name, payload: opts.arguments },
  });
  const finish = (result: ShoppingToolResult) => {
    reduce(
      thread,
      {
        type: "tool_result",
        data: {
          turnId: input.turnId,
          ok: result.ok,
          summary: JSON.stringify(
            result.data ??
              result.reason ??
              result.speakable?.content ??
              "Updated",
          ),
        },
      },
      result.snapshot,
    );
    input.baseRevision = result.snapshot.revision;
    return result;
  };
  try {
    if (!Object.hasOwn(definitions, name))
      throw new Error("Unknown or forbidden shopping tool");
    if (
      input.epoch !== snapshot.epoch ||
      input.baseRevision !== snapshot.revision
    )
      throw new Error("Stale shopping turn");
    if (store instanceof AuthoritativeSessionStore) {
      const turn = store.core.get(input.sessionId).turn;
      if (turn?.id !== input.turnId || turn.status !== "active")
        throw new Error("Turn is cancelled, superseded, or unknown");
    }
    const def = definitions[name as keyof typeof definitions];
    const args = object(def.fields).schema.parse(
      typeof opts.arguments === "string"
        ? JSON.parse(opts.arguments)
        : opts.arguments,
    ) as Record<string, any>;
    const checkProduct = (pid: string) => {
      if (!getProduct(pid)) throw new Error("Unknown platform product ID");
    };
    if (args.productId) checkProduct(args.productId);
    for (const pid of [
      ...(args.productIds ?? []),
      ...(args.exclusions ?? []),
      ...(args.entries ?? []).map((e: any) => e.productId),
    ])
      checkProduct(pid);
    if (
      args.evidenceIds?.some(
        (eid: string) => !EVIDENCE.some((e) => e.id === eid),
      )
    )
      throw new Error("Unknown platform evidence ID");
    if (args.offerId && !getOffer(args.offerId))
      throw new Error("Unknown platform offer ID");
    // Selection and summary use the same authoritative guards as the separate
    // tools. Combining them removes an inference round trip, not a validation.
    if (name === "prepare_summary" && args.offerId) {
      const selected = executeShoppingTool({
        ...opts,
        name: "select_offer",
        arguments: { offerId: args.offerId },
      });
      if (!selected.ok) return finish(selected);
    }
    const quotes = (pid: string, detail = false) =>
      store instanceof AuthoritativeSessionStore
        ? store.quotes(input.sessionId, pid).map((q) => ({
            offer: { id: q.offer.id, sellerName: q.offer.sellerName },
            totalMinor: q.total,
            currency: q.currency,
            eligible: q.eligible,
            budgetStatus: typeof snapshot.hardConstraints.budgetMinor !== "number"
              ? "not_set"
              : q.total === null ? "unknown_total"
                : q.total <= snapshot.hardConstraints.budgetMinor ? "within_budget" : "over_budget",
            deliveryDays: q.offer.deliveryDays,
            conflicts: q.conflicts.map((c) => ({
              code: c.code,
              message: c.message,
            })),
            ...(detail
              ? {
                  quantity: q.quantity,
                  destination: q.destination,
                  lineItemsMinor: {
                    items: q.subtotal,
                    shipping: q.shipping,
                    tax: q.tax,
                    otherFees: q.otherFees,
                    setup: q.setupCost,
                  },
                  deliveryConditions: q.offer.deliveryConditions,
                  returnConditions: q.offer.returnConditions,
                  setupConditions: q.offer.setupConditions,
                  conditions: q.offer.conditions,
                  uncertainties: q.offer.uncertainties,
                  evidenceIds: q.offer.evidenceIds,
                }
              : {}),
          }))
        : {
            unavailable:
              "Authoritative quotes require the production store; do not infer eligibility.",
          };
    const compactProduct = (p: NonNullable<ReturnType<typeof getProduct>>) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      specs: p.specs,
      limitations: p.limitations,
      evidenceIds: p.evidenceIds,
      provenance: p.provenance,
      demoReviews: p.demoReviews,
    });
    if (name === "search_catalog") {
      const query = String(args.query ?? "").trim().toLowerCase();
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const pool = PRODUCTS.filter(
        (p) => !args.category || p.category === args.category,
      );
      const score = (p: (typeof PRODUCTS)[number]) => {
        if (!query) return 0;
        const identity = `${p.id} ${p.brand} ${p.model}`.toLowerCase();
        const facts = JSON.stringify(p.specs).toLowerCase();
        return (p.id.toLowerCase() === query ? 1000 : 0) +
          (identity.includes(query) ? 100 : 0) +
          terms.reduce((sum, term) => sum + (identity.includes(term) ? 5 : facts.includes(term) ? 1 : 0), 0);
      };
      const ranked = pool.map(product => ({ product, score: score(product) }))
        .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
      const offset = args.offset ?? 0;
      const pageSize = 12;
      const keys = ["family", "audioCategory", "formFactor", "solutionType", "connection", "connector", "polar_pattern", "transducer_type", "carryModes", "capacityLitres", "weightGrams", "material", "laptopFitInches", "separateShoeCompartment", "sizeMarket", "fittedWidthInches", "fittedLengthInches", "maxMattressDepthInches", "compositionLabel", "weave", "color"];
      // Quote only the returned page. Each quote still performs authoritative validation.
      const products = ranked.slice(offset, offset + pageSize).map(({ product: p }) => ({
        product: {
          id: p.id, title: p.title, category: p.category, solutionType: p.solutionType,
          provenance: p.provenance?.kind ?? "source_snapshot",
          specs: Object.fromEntries(keys.filter(key => p.specs[key] !== undefined).map(key => [key, p.specs[key]])),
          limitations: p.limitations.slice(0, 2),
          demoReviews: p.demoReviews ? {
            classification: p.demoReviews.classification, disclosure: p.demoReviews.disclosure,
            rating: p.demoReviews.rating, ratingCount: p.demoReviews.ratingCount,
            writtenReviewCount: p.demoReviews.writtenReviewCount,
          } : null,
          reviews: EVIDENCE.filter(e => e.subjectType === "product" && e.subjectId === p.id && e.sourceType === "review").map(e => ({
            evidenceId: e.id, classification: e.classification,
            isDemo: e.classification === "proxy", rating: e.rating ?? null,
            ratingCount: e.ratingCount ?? null, writtenReviewCount: e.writtenReviewCount ?? null,
            scope: e.reviewScope ?? null,
          })),
        },
        quotes: quotes(p.id),
      }));
      return finish({
        ok: true,
        snapshot,
        data: {
          products,
          totalProducts: pool.length,
          matchingProducts: query ? ranked.filter(row => row.score > 0).length : pool.length,
          offset,
          pageSize,
          nextOffset: offset + products.length < pool.length ? offset + products.length : null,
          note: `This page contains ${products.length} of ${pool.length} category products. ${offset + products.length < pool.length ? "More products remain: continue with nextOffset before claiming the catalog has no match. Do not substitute a different product kind merely because it is affordable on this page; a desktop microphone request must not become a headset recommendation while later desktop results remain unchecked." : "This is the final page."} eligible means checkout-ready. A within_budget offer with only HOST_CONNECTION_REQUIRED is a product you can show now, with its connector still to confirm; do not call it over budget or unavailable. Catalog facts include attributed snapshots and explicitly authored demo products. All offers are simulated, not live stock or delivery. Review records marked isDemo are fictional demo content, never real customer testimony. Monetary amounts are integer minor units. Missing specifications are unknown. Query ranks rather than excludes; matchingProducts counts text matches. Inspect a product for complete specifications, evidence, and offer conditions.`,
        },
      });
    }
    if (name === "inspect_product") {
      const offerEvidenceIds = new Set(OFFERS.filter(o => o.productId === args.productId).flatMap(o => o.evidenceIds));
      return finish({
        ok: true,
        snapshot,
        data: {
          product: compactProduct(getProduct(args.productId)!),
          evidence: EVIDENCE.filter(
            (e) =>
              (e.subjectType === "product" && e.subjectId === args.productId) ||
              offerEvidenceIds.has(e.id),
          ),
          quotes: quotes(args.productId, true),
        },
      });
    }
    let action = name as AgentProposal["action"];
    let payload: Record<string, unknown> = args;
    if (name === "show_solution_types") {
      action = "clarify";
      payload = { question: args.question, stage: "solution_types" };
    }
    if (name === "choose_solution_type") {
      // Presenting the choices is not consent to choose one in that same turn.
      if (thread.events.some((event) =>
        event.type === "tool_call" &&
        event.data.turnId === input.turnId &&
        event.data.intent === "show_solution_types"
      ))
        throw new Error("The direction cards were just presented. Explain their tradeoffs and wait for the shopper to choose in their next turn.");
      action = "set_constraints";
      payload = { preferences: { solutionType: args.solutionType } };
    }
    if (name === "navigate_products") {
      action = "focus";
      payload = {
        productId: resolveProductNavigation(
          snapshot,
          args as ProductNavigation,
        ),
      };
    }
    if (name === "remember_requirements") {
      action = "set_constraints";
      if (args.preferences.some((preference: { key: string }) =>
        ["solutionType", "audioDirectionPending"].includes(preference.key)
      ))
        throw new Error("Use choose_solution_type for a shopper-selected microphone direction; do not bypass their choice with remembered preferences.");
      const old = snapshot.hardConstraints;
      if (args.budgetMinor !== null && !Number.isSafeInteger(args.budgetMinor))
        throw new Error("Budget must be integer minor units");
      if (
        typeof old.budgetMinor === "number" &&
        args.budgetMinor > old.budgetMinor &&
        parseBudgetUpdate(input.text ?? "") !== args.budgetMinor
      )
        throw new Error(
          "Budget change not applied: the requested amount does not match an explicit new budget in this shopper turn. This is a validation result, not a temporary service outage. Use the shopper's actual amount if clear; otherwise ask one brief clarification about their intended budget, without asking them to resend the message or try again later.",
        );
      if (
        typeof old.maxDeliveryDays === "number" &&
        args.maxDeliveryDays > old.maxDeliveryDays &&
        !allowsDeliveryExtension(input.text ?? "", args.maxDeliveryDays)
      )
        throw new Error("Keep the existing delivery deadline unless the shopper explicitly changes it. Ask which delivery window they want if unclear; this is a validation limit, not a temporary service failure.");
      const compatibility = { ...((old.compatibility as object) ?? {}) };
      const adapter = adapterContext(input.text ?? "");
      for (const [key, value] of Object.entries(args.compatibility)) {
        if (value === null) continue;
        if (key === "hostConnection" && (adapter.mentionsHardware || usbPath.test(String(value)))) {
          // Preserve an accepted port; a bare adapter correction cannot replace
          // it, and a composite path must never become a literal host value.
          if (adapter.host) Object.assign(compatibility, { hostConnection: normalizeHostConnection(adapter.host) });
          continue;
        }
        const normalized = key === "hostConnection" ? normalizeHostConnection(String(value)) : value;
        if (normalized !== undefined) Object.assign(compatibility, { [key]: normalized });
      }
      const hardConstraints: Record<string, unknown> = {
        ...old,
        compatibility,
      };
      if (
        typeof old.minimumCapacityL === "number" &&
        args.minimumCapacityL !== null &&
        args.minimumCapacityL < old.minimumCapacityL &&
        !allowsCapacityReduction(input.text ?? "", args.minimumCapacityL)
      )
        throw new Error("Keep the existing minimum capacity unless the shopper explicitly changes it. Ask what minimum size they need if unclear; this is a validation limit, not a temporary service failure.");
      if (
        old.separateShoeCompartment === true &&
        args.separateShoeCompartment === false &&
        !allowsRemovingShoeCompartment(input.text ?? "")
      )
        throw new Error(
          "Keep the separate shoe compartment requirement unless the shopper says it is optional or unnecessary. Clarify that preference if unclear; this is a validation limit, not a temporary service failure.",
        );
      for (const key of [
        "budgetMinor",
        "category",
        "maxDeliveryDays",
        "minimumCapacityL",
        "separateShoeCompartment",
      ])
        if (args[key] !== null) hardConstraints[key] = args[key];
      if (args.maxDeliveryDays !== null)
        delete hardConstraints.deliveryWithinDays;
      payload = {
        needs: args.needs,
        hardConstraints,
        preferences: Object.fromEntries(
          [
            ...args.preferences.map((p: any) => [p.key, p.value]),
            ...(adapter.pathLabel ? [["adapterConnection", adapter.pathLabel]] : []),
            ...(adapter.ownsAdapter ? [["ownedAdapter", adapter.pathLabel]] : []),
            ...(args.compatibility.hostConnection !== null && normalizeHostConnection(args.compatibility.hostConnection) === undefined
              ? [["audioConnectionFamily", "usb"]] : []),
          ],
        ),
        exclusions: args.exclusions,
      };
    }
    if (name === "shortlist") {
      const candidates = args.entries.map((entry: { productId: string }) => getProduct(entry.productId)!);
      const audioCandidates = candidates.filter((candidate: (typeof PRODUCTS)[number]) => candidate.category === "audio");
      if (audioCandidates.length && (snapshot.view === "solution_types" || snapshot.preferences.audioDirectionPending === true))
        throw new Error("The shopper is still choosing a microphone direction. Keep the direction cards visible and explain the tradeoffs. On a later shopper turn, use choose_solution_type for their chosen direction (or their explicit request to skip guidance) before shortlisting products.");
      const chosenDirection = snapshot.preferences.solutionType;
      if (["headset", "clip_on", "directional_desktop"].includes(String(chosenDirection)) &&
        audioCandidates.some((candidate: (typeof PRODUCTS)[number]) => candidate.solutionType !== chosenDirection))
        throw new Error("Keep recommendations within the shopper's chosen microphone direction. Use choose_solution_type first only if the shopper asks to change direction or compare products across kinds.");
      if (
        !args.entries.length ||
        args.entries.length > 5 ||
        new Set(args.entries.map((e: any) => e.productId)).size !==
          args.entries.length
      )
        throw new Error("Choose one to five distinct catalog products");
      payload = {
        entries: args.entries.map((e: any, i: number) => ({
          ...e,
          ...(i < 3 ? { rank: ["gold", "silver", "bronze"][i] } : {}),
        })),
      };
    }
    if (
      name === "compare" &&
      (args.productIds.length < 2 ||
        args.productIds.length > 4 ||
        new Set(args.productIds).size !== args.productIds.length)
    )
      throw new Error("Compare two to four distinct visible products");
    if (name === "prepare_summary") payload = {};
    const proposal: AgentProposal = {
      sessionId: input.sessionId,
      epoch: input.epoch,
      turnId: input.turnId,
      baseRevision: input.baseRevision,
      eventId: `tool-${crypto.randomUUID()}`,
      action,
      payload,
      evidenceIds: args.evidenceIds ?? [],
    };
    const result = store.apply(proposal);
    // A failed checkout must explain the actual accepted connector and blocker.
    // A generic selection error otherwise looks like missing shopper context
    // and encourages asking the same hardware question on every retry.
    let checkoutFailure: Record<string, unknown> | undefined;
    if (!result.ok && (name === "select_offer" || name === "prepare_summary") &&
        store instanceof AuthoritativeSessionStore) {
      const offerId = typeof args.offerId === "string" ? args.offerId : result.snapshot.selectedOfferId;
      const quote = offerId ? store.quotes(input.sessionId, getOffer(offerId)?.productId)
        .find((candidate) => candidate.offer.id === offerId) : undefined;
      if (quote && !quote.eligible) {
        const constraints = store.core.get(input.sessionId).constraints;
        const hostConnection = normalizeHostConnection(constraints.hostConnection) ??
          normalizeHostConnection(constraints.compatibility?.hostConnection);
        const missingHost = quote.conflicts.some((conflict) => conflict.code === "HOST_CONNECTION_REQUIRED");
        checkoutFailure = {
          offerId,
          productId: quote.product.id,
          conflicts: quote.conflicts,
          hostConnection: hostConnection ?? null,
          supportedHostConnections: quote.product.compatibility?.hostConnections ?? [],
          needsHostConnection: missingHost,
          nextStep: missingHost
            ? "Ask once for the computer's specific connector. When the shopper answers, remember it and retry this requested offer without asking whether they still want to buy."
            : hostConnection
              ? "The shopper's connector is already known. Reuse it; do not ask for it again or invent a different port, cable, or adapter. Explain the actual conflict and resolve only the missing fact or supported alternative. Once eligible, continue the requested order review; approval still belongs to the shopper."
              : "Explain the listed conflict and resolve only the missing fact. Continue the requested order review when eligible; approval still belongs to the shopper.",
        };
      }
    }
    return finish({
      ...result,
      proposal,
      ...(checkoutFailure ? { data: { reason: result.reason, checkout: checkoutFailure } } : {}),
      ...(name === "prepare_summary" && result.ok
        ? { canonicalSummary: true }
        : {}),
    });
  } catch (error) {
    return finish({
      ok: false,
      snapshot,
      reason:
        error instanceof z.ZodError
          ? "Invalid tool arguments: " +
            error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : error instanceof Error
            ? error.message
            : "Invalid shopping request",
    });
  }
}
