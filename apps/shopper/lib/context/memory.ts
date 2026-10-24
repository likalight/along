export const MEMORY_STORAGE_KEY = "along.reviewed-context.v1";
export type ReviewedPreference = {
  id: string;
  key: "color" | "shape";
  value: string;
  sourceApp: string;
  sourceEventID: string;
  observedAt: string;
  approvedAt: string;
};
const allowed: Record<string, readonly string[]> = {
  color: ["black", "navy", "olive", "khaki", "slate"],
  shape: ["backpack", "tote", "sling", "duffel"],
};
const ageLimit = 90 * 86400000;

/** Shared browser/server boundary. Imported prose never becomes agent instructions. */
export function parsePreferences(raw: unknown): ReviewedPreference[] {
  if (!Array.isArray(raw) || raw.length > 2)
    throw new Error("Expected at most two reviewed preferences.");
  const keys = new Set<string>();
  return raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("Invalid preference.");
    const r = item as Record<string, unknown>;
    const fields = [
      "id",
      "key",
      "value",
      "sourceApp",
      "sourceEventID",
      "observedAt",
      "approvedAt",
    ];
    if (
      Object.keys(r).some((k) => !fields.includes(k)) ||
      fields.some(
        (k) =>
          typeof r[k] !== "string" ||
          !(r[k] as string).length ||
          (r[k] as string).length > 160,
      )
    )
      throw new Error("Invalid preference fields.");
    const key = r.key as string;
    if (
      !Object.hasOwn(allowed, key) ||
      !allowed[key].includes(r.value as string) ||
      keys.has(key)
    )
      throw new Error("Only one supported value per preference is allowed.");
    keys.add(key);
    const observed = Date.parse(r.observedAt as string),
      approved = Date.parse(r.approvedAt as string),
      now = Date.now();
    if (
      !Number.isFinite(observed) ||
      !Number.isFinite(approved) ||
      observed > approved ||
      approved > now + 60000 ||
      approved < now - ageLimit
    )
      throw new Error(
        "Preference dates are invalid or older than 90 days. Review them again in the companion.",
      );
    return Object.fromEntries(
      fields.map((k) => [k, r[k]]),
    ) as ReviewedPreference;
  });
}

export function parseContextExport(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid context export.");
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== 1 || r.source !== "along-mac-companion")
    throw new Error("Choose an Along Context v1 export.");
  return parsePreferences(r.memories);
}

export function readLocalPreferences(): ReviewedPreference[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    return raw ? parsePreferences(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}
