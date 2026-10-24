import { describe, expect, it, vi } from "vitest";
import { agreedCatalog } from "@coupang/contract";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { canvasData, project } from "@/lib/integration/projection";
import { getRuntime } from "@/lib/integration/runtime";
import { productImage, productImageFallback } from "@/lib/canvas/product-media";
import {
  audioSolution,
  reviewEvidence,
} from "@/lib/canvas/product-presentation";
import { consumerDetails } from "@/lib/canvas/consumer-details";

describe("expanded catalogue presentation", () => {
  it("projects the full seeded pool, preserving canonical media and separately labelled demo reviews", () => {
    expect(canvasData.products).toHaveLength(148);
    expect(
      canvasData.products.filter((p) => p.category === "audio"),
    ).toHaveLength(100);
    expect(
      canvasData.products.filter((p) => p.category === "bags"),
    ).toHaveLength(24);
    expect(
      canvasData.products.filter((p) => p.category === "bedsheets"),
    ).toHaveLength(24);
    for (const product of canvasData.products) {
      const source = agreedCatalog.products.find(
        (row: { id: string }) => row.id === product.id,
      );
      expect(product.image).toEqual(source.image);
      expect(product.demoReviews).toEqual(source.demoReviews);
      expect(product.demoReviews?.classification).toBe("proxy");
      expect(product.demoReviews?.entries.length).toBeGreaterThanOrEqual(3);
      expect(
        product.demoReviews?.entries.every((entry) => !entry.verifiedPurchase),
      ).toBe(true);
      expect(
        existsSync(
          join(process.cwd(), "public", productImageFallback(product.id)),
        ),
      ).toBe(true);
    }
  });

  it("shows meaningful specifications and all new end-of-pool products", () => {
    for (const id of ["MIC-100", "BAG-024", "BED-024"]) {
      const product = canvasData.products.find((product) => product.id === id)!;
      expect(product, id).toBeDefined();
      expect(consumerDetails(product.specs).length, id).toBeGreaterThan(2);
      expect(product.image.url).toBe(`/catalog/images/products/${id}.webp`);
      expect(["snapshot", "proxy"]).toContain(product.image.classification);
      expect(product.image.source).toMatch(/photo/i);
    }
    expect(
      consumerDetails(
        canvasData.products.find((p) => p.id === "BAG-024")!.specs,
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Style" })]));
    expect(
      consumerDetails(
        canvasData.products.find((p) => p.id === "BED-024")!.specs,
      ).some((row) => row.label === "Material" || row.label === "Composition" || row.label === "Finish"),
    ).toBe(true);
    expect(
      canvasData.products.find((p) => p.id === "BAG-024")?.classification,
    ).toBe("snapshot");
    expect(
      canvasData.products.find((p) => p.id === "MIC-100")?.classification,
    ).toBe("snapshot");
  });

  it("uses canonical source review identity without confusing synthetic and real aggregates", () => {
    const product = canvasData.products.find(
      (product) => product.id === "MIC-099",
    )!;
    const review = reviewEvidence(product, canvasData.evidence);
    expect(review?.id).toBe("REV-MIC-099");
    expect(review?.rating).toBe(2);
    expect(review?.ratingCount).toBe(1);
    expect(review?.writtenReviewCount).toBe(0);
    expect(review?.classification).toBe("snapshot");
    expect(product.demoReviews?.classification).toBe("proxy");
    expect(
      reviewEvidence(
        canvasData.products.find((p) => p.id === "BAG-024")!,
        canvasData.evidence,
      ),
    ).toBeUndefined();
  });

  it("recognizes audio subtype from the supplied group even when model names omit it", () => {
    expect(
      audioSolution("audio-accessories", "Sony WH-1000XM6/B", {
        representationGroup: "Headphones, earbuds, and headsets",
      }),
    ).toBe("headset");
    expect(
      audioSolution("audio-accessories", "Shure MoveMic Two", {
        representationGroup: "Lavaliers and wearable clip-on microphones",
      }),
    ).toBe("clip");
    expect(
      audioSolution("everyday-bags", "Headset carry bag", {}),
    ).toBeUndefined();
  });

  it("preserves canonical images and provides a universal local fallback", () => {
    const canonical = {
      url: "/custom/catalogue.png",
      alt: "Custom image",
      source: "AI-generated illustration",
      classification: "proxy" as const,
    };
    expect(productImage("BAG-024", "Test bag", canonical)).toBe(canonical);
    expect(productImageFallback("MIC-100")).toBe("/catalog/images/audio.svg");
    expect(productImageFallback("BAG-024")).toBe("/catalog/images/bag.svg");
    expect(productImageFallback("BED-024")).toBe("/catalog/images/bedding.svg");
  });

  it("does not quote the entire catalogue for an opening session", () => {
    const { store, orch } = getRuntime();
    const session = orch.createSession();
    const quotes = vi.spyOn(store, "quotes");
    try {
      const projected = project(session.sessionId);
      expect(projected.catalog?.products).toHaveLength(148);
      expect(quotes).not.toHaveBeenCalled();
    } finally {
      quotes.mockRestore();
    }
  });
});
