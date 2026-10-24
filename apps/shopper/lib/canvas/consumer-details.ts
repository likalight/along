/** Only catalog fields with a consumer meaning may reach the listing. */
export function consumerDetails(
  specs: Record<string, unknown>,
): { label: string; value: string }[] {
  const read = (key: string): unknown => {
    const value = specs[key];
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
  const text = (value: unknown): string | null =>
    typeof value === "string" &&
    value.trim() &&
    !/^[\[{]/.test(value.trim()) &&
    !/^(null|undefined|unspecified)$/i.test(value.trim())
      ? customerCopy(value.trim()) || null
      : null;
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null) => {
    if (value && !rows.some((row) => row.label === label))
      rows.push({ label, value });
  };
  const number = (key: string) => {
    const value = read(key);
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  };
  const units: Record<string, [string, string]> = {
    capacityLitres: ["Capacity", "L"],
    expandedCapacityLitres: ["Expanded capacity", "L"],
    weightGrams: ["Weight", "g"],
    laptopFitInches: ["Laptop sleeve", "in"],
    maxMattressDepthInches: ["Maximum mattress depth", "in"],
    pocketDepthInches: ["Pocket depth", "in"],
    fabricWeightGsm: ["Fabric weight", "g/m²"],
    threadCount: ["Thread count", ""],
  };
  for (const [key, [label, unit]] of Object.entries(units)) {
    const value = number(key);
    if (value !== null) add(label, `${value}${unit ? ` ${unit}` : ""}`);
  }
  const labels: Record<string, string> = {
    connection: "Connection",
    power: "Power",
    additional_hardware: "What you need",
    noise_strategy: "Microphone features",
    polar_pattern: "Pickup pattern",
    "capsule / mic system": "Microphone",
    material: "Material",
    compositionLabel: "Fabric",
    weave: "Weave",
    sizeMarket: "Size",
    care: "Care",
    color: "Colour",
    pattern: "Pattern",
    style: "Style",
    closure: "Closure",
    finish: "Finish",
    warranty: "Warranty",
    waterResistance: "Water resistance",
    dimensionCaveat: "Sizing note",
    depthCaveat: "Depth note",
    Connection: "Connection",
    Capacity: "Capacity",
    Shape: "Shape",
    Compartments: "Compartments",
    Dimensions: "Dimensions",
    "Mattress depth": "Maximum mattress depth",
    Composition: "Fabric",
    Includes: "Included",
    Care: "Care",
    "Setup check": "Before you buy",
  };
  for (const [key, label] of Object.entries(labels))
    add(label, text(read(key)));
  for (const [key, label] of [
    ["carryModes", "Carry it"],
    ["compartments", "Compartments"],
    ["bestFor", "Suggested uses"],
  ]) {
    const value = read(key);
    if (Array.isArray(value))
      add(label, value.map(text).filter(Boolean).join(", ") || null);
  }
  const shoe = read("separateShoeCompartment");
  if (typeof shoe === "boolean")
    add(
      "Shoe storage",
      shoe ? "Separate shoe compartment" : "No separate shoe compartment",
    );
  const dimensions = read("dimensions");
  if (
    dimensions &&
    typeof dimensions === "object" &&
    !Array.isArray(dimensions)
  ) {
    const d = dimensions as Record<string, unknown>;
    if (["cm", "in", "mm"].includes(String(d.unit))) {
      const axes = [
        ["height", "H"],
        ["width", "W"],
        ["depth", "D"],
      ].flatMap(([key, label]) =>
        typeof d[key] === "number" &&
        Number.isFinite(d[key]) &&
        Number(d[key]) > 0
          ? [`${d[key]} ${label}`]
          : [],
      );
      add("Dimensions", axes.length ? `${axes.join(" × ")} ${d.unit}` : null);
    }
  }
  for (const [prefix, label] of [
    ["fitted", "Fitted sheet"],
    ["flat", "Flat sheet"],
    ["pillowcase", "Pillowcase"],
  ]) {
    const width = number(`${prefix}WidthInches`),
      length = number(`${prefix}LengthInches`);
    if (width !== null && length !== null)
      add(label, `${width} × ${length} in`);
  }
  const pieces = read("includedPieces");
  if (pieces && typeof pieces === "object" && !Array.isArray(pieces)) {
    const p = pieces as Record<string, unknown>;
    add(
      "Included",
      [
        ["fitted", "fitted sheet"],
        ["flat", "flat sheet"],
        ["pillowcases", "pillowcase"],
      ]
        .flatMap(([key, label]) =>
          typeof p[key] === "number" &&
          Number.isInteger(p[key]) &&
          Number(p[key]) > 0
            ? [`${p[key]} ${label}${Number(p[key]) > 1 ? "s" : ""}`]
            : [],
        )
        .join(", ") || null,
    );
  }
  return rows;
}
import { customerCopy } from "./customer-copy";
