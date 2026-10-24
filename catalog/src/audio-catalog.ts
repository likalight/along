import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { legacyMicrophoneArchive, decimalToMinor } from "./microphone-import.ts";
import { emptyMetrics } from "./types.ts";
import type { Evidence, Product } from "./types.ts";

type LegacyRow = typeof legacyMicrophoneArchive.records[number];
type AudioRow = Omit<LegacyRow, "authoredFit"> & {
  authoredFit: LegacyRow["authoredFit"] | null;
  representationGroup: string; referenceFile: string; detailStatus: "legacy_details_available" | "linked_file_not_supplied";
  indexRow: Record<string, string>;
};
const cells = (line: string) => line.split("|").slice(1, -1).map(value => value.trim());
/** Parse supplied index only; prose is source material, never an executable instruction. */
export function importMicrophoneIndex(source: string, legacy = legacyMicrophoneArchive) {
  const records: AudioRow[] = [];
  let group = "", headers: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("### ")) group = line.slice(4).replace(/ — 25 options$/, "");
    if (line.startsWith("| id |")) headers = cells(line);
    if (!line.startsWith("| MIC-")) continue;
    const values = cells(line);
    if (values.length !== headers.length) throw new Error("INDEX_COLUMN_MISMATCH");
    const row = Object.fromEntries(headers.map((key, index) => [key, values[index]]));
    if (!/^MIC-\d{3}$/.test(row.id) || !group) throw new Error("INVALID_INDEX_ID_OR_GROUP");
    const sourceUrl = row["external source"].match(/\]\((https:\/\/[^)]+)\)/)?.[1];
    const referenceFile = row["shareable reference file"].match(/\]\(([^)]+)\)/)?.[1];
    if (!sourceUrl || !referenceFile || !/^2026-10-(24|25)$/.test(row["snapshot date"])) throw new Error("INVALID_INDEX_PROVENANCE");
    const match = row["stars / count"].match(/^(null|\d+(?:\.\d+)?\/5) \/ (null|\d+)$/);
    if (!match) throw new Error("INVALID_INDEX_REVIEWS");
    const rating = match[1] === "null" ? null : Number(match[1].replace("/5", ""));
    const count = match[2] === "null" ? null : Number(match[2]);
    if (rating !== null && (rating < 0 || rating > 5)) throw new Error("INVALID_INDEX_RATING");
    const amountMinor = decimalToMinor(row.USD);
    const previous = legacy.records.find(r => r.id === row.id);
    if (previous) {
      // Any changed old row requires reconciliation; silently refreshing old snapshots is forbidden.
      if (previous.brand !== row.brand || previous.model !== row["model / configuration"] || previous.checkedOn !== row["snapshot date"] ||
        previous.referencePrice.amountMinor !== amountMinor || previous.referencePrice.price_kind !== row.price_kind ||
        previous.availability !== row.availability || previous.buyerMetrics.rating !== rating || previous.referenceCustomerReviewCount !== count || previous.productSource !== sourceUrl)
        throw new Error(`LEGACY_INDEX_DRIFT:${row.id}`);
      records.push({ ...previous, representationGroup: group, referenceFile, detailStatus: "legacy_details_available", indexRow: row });
    } else {
      const scope = row.id === "MIC-099"
        ? "Supplied index explicitly distinguishes one star-only rating from zero written reviews; linked detail file was not supplied."
        : "Supplied index stars/count. Linked detail file was not supplied: exact-kit scope, publisher rounding and indexed precision are unverified. Count retained as written-review count; rating-vote count unknown.";
      records.push({
        id: row.id, checkedOn: row["snapshot date"], currency: "USD", brand: row.brand, model: row["model / configuration"],
        referencePrice: { currency: "USD", amountMinor, price_kind: row.price_kind, payableTotalMinor: null },
        availability: row.availability, review_scope: scope, productSource: sourceUrl, reviewSource: rating !== null || count !== null ? sourceUrl : null,
        referenceCustomerReviewCount: count,
        buyerMetrics: { ...emptyMetrics(), rating, writtenReviewCount: count, ratingCount: row.id === "MIC-099" ? 1 : null, reviewScope: scope },
        technical: { "capsule / mic system": "Unknown — linked detail file not supplied", polar_pattern: "Unknown", connection: "Unknown — exact host path unverified", power: "Unknown", additional_hardware: "Unknown — see separately labelled simulated setup", noise_strategy: "Unknown — no source specification captured" },
        authoredFit: null, feedbackParaphrase: null,
        variantNotes: "Only the index was supplied for this product; detailed specifications, individual review text and fit scores remain unknown.",
        sourceRows: { commercial: row, technical: {}, reviews: { customer_rating_out_of_5: rating === null ? "null" : String(rating), customer_review_count: count === null ? "null" : String(count), review_scope: scope } },
        executable: false, representationGroup: group, referenceFile, detailStatus: "linked_file_not_supplied", indexRow: row,
      });
    }
  }
  const ids = new Set(records.map(r => r.id));
  if (records.length !== 100 || ids.size !== 100 || Array.from({ length: 100 }, (_, n) => `MIC-${String(n + 1).padStart(3, "0")}`).some(id => !ids.has(id))) throw new Error("EXPECTED_100_UNIQUE_AUDIO_IDS");
  const groups = new Set(records.map(r => r.representationGroup));
  if (groups.size !== 4 || [...groups].some(g => records.filter(r => r.representationGroup === g).length !== 25)) throw new Error("EXPECTED_FOUR_BALANCED_AUDIO_GROUPS");
  return { sourceSha256: createHash("sha256").update(source).digest("hex"), sourceFile: "sources/microphone-demo-data-100.md",
    detailSourceFile: legacy.sourceFile, detailSourceSha256: legacy.sourceSha256, independentlyReverified: false,
    notice: "Team-supplied index plus original 50-row detail archive. Linked standalone files were not supplied. All offers, images and demo reviews are separate fictional fixtures.",
    records: records.sort((a, b) => a.id.localeCompare(b.id)) };
}
export const microphoneArchive = importMicrophoneIndex(readFileSync(new URL("../sources/microphone-demo-data-100.md", import.meta.url), "utf8"));
export const activeAudioIds = microphoneArchive.records.map(r => r.id);

type Path = { supportedHostConnections: string[]; requiredHardwareIds: string[]; classification: "proxy"; notice: string };
const legacyPaths: Record<string, [string[], string[]]> = {
  "MIC-001": [["usb-c"], []], "MIC-003": [["usb-a"], []], "MIC-009": [["usb-a"], []],
  "MIC-015": [["usb-c"], []], "MIC-020": [["usb-a"], ["usb-a-to-c-data-cable"]], "MIC-022": [["usb-a"], ["usb-a-to-c-data-cable"]],
  "MIC-025": [["usb-a"], []], "MIC-037": [["usb-c"], ["usb-c-trs-mic-interface"]], "MIC-038": [["usb-c"], []],
  "MIC-040": [["usb-c"], ["usb-c-data-cable"]], "MIC-044": [["usb-c"], ["usb-c-data-cable", "desktop-mic-stand"]],
  "MIC-047": [["usb-c"], ["usb-c-trs-mic-interface", "desktop-mic-stand"]],
};
function pathFor(row: AudioRow): Path {
  const preserved = legacyPaths[row.id];
  let [supportedHostConnections, requiredHardwareIds] = preserved ?? [[], []];
  if (!preserved) {
    const connection = row.technical.connection.toLowerCase();
    if (row.detailStatus === "legacy_details_available") {
      if (connection.includes("usb-c")) supportedHostConnections.push("usb-c");
      if (connection.includes("usb-a")) supportedHostConnections.push("usb-a");
      if (connection.includes("bluetooth")) supportedHostConnections.push("bluetooth");
      if (!supportedHostConnections.length && connection.includes("usb")) { supportedHostConnections = ["usb-c"]; requiredHardwareIds = ["universal-usb-data-kit"]; }
      if (!supportedHostConnections.length && connection.includes("xlr")) { supportedHostConnections = ["usb-c"]; requiredHardwareIds = ["usb-c-xlr-audio-kit", "desktop-mic-stand"]; }
      if (!supportedHostConnections.length && connection.includes("3.5")) { supportedHostConnections = ["usb-c"]; requiredHardwareIds = [connection.includes("trrs") ? "usb-c-trrs-mic-interface" : "usb-c-trs-mic-interface"]; }
      if (/Stand \/ boom arm/.test(row.technical.additional_hardware) && !requiredHardwareIds.includes("desktop-mic-stand")) requiredHardwareIds.push("desktop-mic-stand");
    } else {
      // Exact connectors literally present in the supplied configuration can seed a simulated path.
      // Other configurations remain quote-ineligible until their missing detail file is supplied.
      if (/USB-C/i.test(row.model)) supportedHostConnections.push("usb-c");
      if (/USB-A/i.test(row.model)) supportedHostConnections.push("usb-a");
      if (/3\.5mm/i.test(row.model)) { supportedHostConnections = ["usb-c"]; requiredHardwareIds = ["usb-c-trs-mic-interface"]; }
      if (!supportedHostConnections.length) {
        supportedHostConnections = ["usb-c"];
        if (row.representationGroup.startsWith("Headphones")) {
          if (/AirPods|WH-1000|Surround|IMPACT|Wireless/i.test(row.model)) supportedHostConnections.push("bluetooth");
          requiredHardwareIds = ["universal-usb-data-kit"];
        } else if (row.representationGroup.startsWith("Lavaliers")) {
          requiredHardwareIds = /Wireless|Mic 3|LARK|MoveMic/i.test(row.model) ? ["universal-usb-data-kit"] : ["usb-c-trs-mic-interface"];
        } else if (row.representationGroup.startsWith("Directional")) {
          requiredHardwareIds = ["universal-usb-data-kit", "desktop-mic-stand"];
        } else if (/Speak|Sync|PowerConf|ATR4697|SpeechMike|PowerMic/i.test(row.model)) {
          requiredHardwareIds = ["universal-usb-data-kit"];
        } else {
          requiredHardwareIds = ["usb-c-xlr-audio-kit", "desktop-mic-stand"];
        }
      }
    }
  }
  return { supportedHostConnections, requiredHardwareIds, classification: "proxy", notice:
    "Authored simulated host path and bundle. This enables demo checkout only; exact real retail compatibility, connectors, power and package contents are unverified." };
}
export function buildAudio() {
  const products: Product[] = [], evidence: Evidence[] = [];
  for (const r of microphoneArchive.records) {
    const id = r.id, specId = `SRC-${id}`, compatibilityId = `COMPAT-${id}`;
    const base = { ...emptyMetrics(), subjectType: "product" as const, subjectId: id, checkedOn: r.checkedOn };
    evidence.push({ ...base, id: specId, sourceUrl: r.productSource, sourceType: "merchant", classification: "snapshot",
      claim: `Supplied ${r.detailStatus === "legacy_details_available" ? "archive specifications and variant notes" : "index price, stock and exact configuration only"}: ${r.variantNotes}` });
    const evidenceIds = [specId, compatibilityId];
    const path = pathFor(r);
    evidence.push({ ...base, id: compatibilityId, sourceUrl: null, sourceType: "fixture", classification: "proxy", claim: path.notice });
    if (r.authoredFit) { evidenceIds.push(`FIT-${id}`); evidence.push({ ...base, id: `FIT-${id}`, sourceUrl: null, sourceType: "authored", classification: "proxy", claim: r.authoredFit.assessment }); }
    if (r.reviewSource) { evidenceIds.push(`REV-${id}`); evidence.push({ ...base, ...r.buyerMetrics, id: `REV-${id}`, sourceUrl: r.reviewSource,
      sourceType: "review", classification: "snapshot", claim: r.feedbackParaphrase ?? "Source aggregate/count captured; individual review text not supplied." }); }
    products.push({ id, category: "audio-accessories", brand: r.brand, model: r.model, variantId: `${id}-DEMO`, title: `${r.brand} ${r.model}`, checkedOn: r.checkedOn,
      provenance: { kind: "source_snapshot", notice: `Team-supplied source snapshot dated ${r.checkedOn}; ${r.detailStatus === "legacy_details_available" ? "original technical archive retained" : "linked detail file not supplied"}.` },
      image: { url: "/catalog/images/audio.svg", alt: "Generic demo audio illustration, not a photograph of this model", source: "Authored demo illustration", classification: "proxy" },
      specs: { ...r.technical, sourceVariant: r.model, representationGroup: r.representationGroup, family: r.representationGroup, solutionType: r.representationGroup.startsWith("Headphones") ? "headset" : r.representationGroup.startsWith("Lavaliers") ? "clip" : "desktop", detailStatus: r.detailStatus, sourceReferenceFile: r.referenceFile,
        specificationClassification: "snapshot", demoConfiguration: { classification: "proxy", hostConnections: path.supportedHostConnections, setupHardwareIds: path.requiredHardwareIds, notice: path.notice }, compatibilityFixture: path },
      limitations: ["No measured café-dictation performance evidence.", r.technical.additional_hardware, "Host paths are bounded simulation fixtures; real compatibility is unverified.", ...(r.detailStatus === "linked_file_not_supplied" ? [r.variantNotes] : [])],
      evidenceIds, sourceUrls: [r.productSource!, ...(r.reviewSource && r.reviewSource !== r.productSource ? [r.reviewSource] : [])],
      referencePrice: r.referencePrice, sourceAvailability: r.availability, buyerMetrics: r.buyerMetrics, authoredFit: r.authoredFit,
      video: { status: "missing", reason: "No permission-verified playable product video/excerpt was supplied." } });
  }
  return { products, evidence };
}
