import { describe, expect, it } from "vitest";
import { consumerDetails } from "../lib/canvas/consumer-details";

describe("consumer product details", () => {
  it("turns projected dimensions, units, lists and booleans into readable facts", () => {
    expect(
      consumerDetails({
        dimensions:
          '{"height":37.5,"width":50,"depth":19,"unit":"cm","axisOrder":"manufacturer H/W/D"}',
        capacityLitres: "26",
        carryModes: '["tote","backpack"]',
        separateShoeCompartment: "false",
      }),
    ).toEqual([
      { label: "Capacity", value: "26 L" },
      { label: "Carry it", value: "tote, backpack" },
      { label: "Shoe storage", value: "No separate shoe compartment" },
      { label: "Dimensions", value: "37.5 H × 50 W × 19 D cm" },
    ]);
  });
  it("never exposes tool metadata, unknown fields or malformed serialized structures", () => {
    expect(
      consumerDetails({
        demoVariant: '{"classification":"proxy"}',
        compatibilityFixture: "{}",
        sourceVariant: "INTERNAL-SKU",
        specificationClassification: "snapshot",
        unknown: "secret",
        material: "{broken",
        care: "null",
        dimensions: '{"width":"50","unit":"cm"}',
      }),
    ).toEqual([]);
  });
  it("formats set contents without inventing package contents or losing pluralization", () => {
    expect(
      consumerDetails({
        includedPieces: '{"fitted":1,"flat":1,"pillowcases":2}',
        fittedWidthInches: "60",
        fittedLengthInches: "80",
      }),
    ).toEqual([
      { label: "Fitted sheet", value: "60 × 80 in" },
      {
        label: "Included",
        value: "1 fitted sheet, 1 flat sheet, 2 pillowcases",
      },
    ]);
    expect(
      consumerDetails({
        includedPieces: "null",
        demoVariant: '{"includedPieces":{"fitted":1}}',
      }),
    ).toEqual([]);
  });
  it("keeps fixture specifications readable and omits duplicate labels", () => {
    expect(
      consumerDetails({
        Capacity: "26 L",
        capacityLitres: 26,
        Connection: "USB-C",
      }),
    ).toEqual([
      { label: "Capacity", value: "26 L" },
      { label: "Connection", value: "USB-C" },
    ]);
  });
});
