import type { CanvasData, Evidence, Offer, Product } from "./contracts";

const image = (kind: string, label: string) => ({
  url: `/canvas/${kind}.svg`,
  alt: `${label}; schematic illustration, not a product photograph`,
  source: "Along demo team · original schematic",
  classification: "proxy" as const,
});
const mic = (
  id: string,
  brand: string,
  model: string,
  variantId: string,
  solution: Product["solution"],
  price: number,
  fit: string,
  limitation: string,
  connection: string,
  url: string,
  availability: Product["availability"] = "in_stock",
): Product => ({
  id,
  category: "audio",
  brand,
  model,
  variantId,
  title: model,
  image: image(solution!, model),
  specs: {
    Connection: connection,
    "Why it may help": fit,
    "Setup check": limitation,
  },
  limitations: [limitation],
  evidenceIds: [`${id}-spec`, `${id}-reviews`, `${id}-video`],
  solution,
  referencePriceMinor: price,
  availability,
  classification: "snapshot",
});
export const products: Product[] = [
  mic(
    "MIC-001",
    "Apple",
    "EarPods",
    "USB-C",
    "headset",
    1900,
    "An inline mic travels easily with your laptop.",
    "Nearby conversations can still interfere; no dedicated mic suppression verified.",
    "USB-C",
    "https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c",
  ),
  mic(
    "MIC-003",
    "Logitech",
    "H390",
    "USB-A",
    "headset",
    2199,
    "A close boom brings your speech nearer to the microphone in a café.",
    "Wired, visible headset; USB-C laptops need an adapter.",
    "USB-A",
    "https://www.logitech.com/en-us/shop/p/h390-usb-headset",
    "unknown",
  ),
  mic(
    "MIC-009",
    "Jabra",
    "Evolve2 65 Flex",
    "Link380a UC Stereo",
    "headset",
    27700,
    "ClearVoice processing and close boom placement target transmitted speech.",
    "Receiver is USB-A; headphone ANC is separate from microphone processing.",
    "Bluetooth / USB-A receiver",
    "https://www.jabra.com/business/office-headsets/jabra-evolve/jabra-evolve2-65-flex",
    "unknown",
  ),
  mic(
    "MIC-015",
    "Shure",
    "MV6 Gen 2",
    "Black · USB-C",
    "desktop",
    16900,
    "Close directional capture and a denoiser may help your voice dominate.",
    "Needs desk space and close placement; café dictation accuracy is unmeasured.",
    "USB-C",
    "https://www.sweetwater.com/store/detail/MV6G2K--shure-mv6-gen-2-usb-gaming-microphone-black",
  ),
  mic(
    "MIC-020",
    "FIFINE",
    "AmpliGame AM8",
    "Base stand + USB cable",
    "desktop",
    5799,
    "Directional close capture offers an affordable hands-free desk setup.",
    "Stock stand height matters; no dedicated denoiser verified.",
    "USB-C / XLR",
    "https://fifinemicrophone.com/collections/microphones/products/fifine-ampligame-am8-microphone",
    "unknown",
  ),
  mic(
    "MIC-022",
    "RØDE",
    "NT-USB Mini",
    "USB-C · magnetic stand",
    "desktop",
    10900,
    "Compact directional pickup keeps a small desktop footprint.",
    "Distant placement admits room sound; quieter desks suit it better.",
    "USB-C",
    "https://www.sweetwater.com/store/detail/NTUSBMini--rode-nt-usb-mini-usb-condenser-microphone",
  ),
  mic(
    "MIC-025",
    "Logitech / Blue",
    "Snowball iCE",
    "Black",
    "desktop",
    4999,
    "A legacy compact USB option.",
    "Unavailable in the captured official listing; excluded from recommendations.",
    "USB mini-B",
    "https://www.logitechg.com/en-us/shop/p/snowball-ice-usb-microphone",
    "unavailable",
  ),
  mic(
    "MIC-037",
    "RØDE",
    "Lavalier GO",
    "Black · mic only",
    "clip",
    8900,
    "A small clothing-mounted microphone keeps your ears free.",
    "Requires a compatible powered TRS input or adapter; clothing can rustle.",
    "3.5mm TRS",
    "https://www.sweetwater.com/store/detail/LavalierGO--rode-lavalier-go-professional-wearable-microphone",
  ),
  mic(
    "MIC-038",
    "DJI",
    "Mic Mini",
    "1 TX + 1 RX",
    "clip",
    5900,
    "Tiny wearable transmitter for a portable kit.",
    "Captured kit was out of stock; not recommended as available.",
    "USB-C receiver / 3.5mm",
    "https://store.dji.com/product/dji-mic-mini",
    "unavailable",
  ),
  mic(
    "MIC-040",
    "RØDE",
    "Wireless ME",
    "Single TX kit",
    "clip",
    14900,
    "Close clip-on capture is portable and leaves your ears free.",
    "GainAssist controls level, not noise cancellation; check receiver mic routing.",
    "USB-C receiver / 3.5mm",
    "https://www.sweetwater.com/store/detail/WirelessME--rode-wireless-me-clip-on-wireless-microphone-system",
  ),
  mic(
    "MIC-044",
    "RØDE",
    "VideoMic GO II",
    "Helix mount",
    "desktop",
    10900,
    "Directional pickup can work close to your voice while leaving ears free.",
    "USB cable and desktop mount may be extra; machinery noise can still be captured.",
    "USB-C / 3.5mm",
    "https://www.sweetwater.com/store/detail/VideoMicGo2H--rode-videomic-go-ii-camera-mounted-shotgun-microphone",
  ),
  mic(
    "MIC-047",
    "Deity",
    "V-Mic D4 Mini",
    "TRS + TRRS host cable",
    "desktop",
    4995,
    "Small directional microphone for a portable desk setup.",
    "USB-only laptops need a mic-capable powered adapter and mount.",
    "3.5mm TRS / TRRS",
    "https://shop.deitymic.com/products/d4-mini",
  ),
  ...["Dayform", "Softline", "Weekday", "Arc", "Transit", "Fold"].map(
    (name, i): Product => ({
      id: `BAG-00${i + 1}`,
      category: "bags",
      brand: "Along Studio",
      model: name,
      variantId: [
        "Navy · 22 L",
        "Slate · 24 L",
        "Navy · 20 L",
        "Sand · 21 L",
        "Black · 25 L",
        "Navy · 18 L",
      ][i],
      title: `${name} work + gym bag`,
      image: image(i === 3 ? "tote" : "bag", `${name} bag`),
      specs: {
        Capacity: `${[22, 24, 20, 21, 25, 18][i]} L`,
        Shape: i === 3 ? "Structured tote" : "Soft rounded silhouette",
        Compartments:
          i < 3
            ? "Laptop sleeve + separate kit pocket"
            : "Single main compartment",
      },
      limitations: [
        i < 3
          ? "Synthetic capacity and pocket layout; no physical fit check."
          : "No separate shoe pocket; check laptop dimensions.",
      ],
      evidenceIds: [
        `BAG-00${i + 1}-spec`,
        `BAG-00${i + 1}-reviews`,
        `BAG-00${i + 1}-video`,
      ],
      referencePriceMinor: [8900, 9900, 7900, 6900, 11900, 5900][i],
      availability: "in_stock",
      classification: "proxy",
    }),
  ),
  ...[
    "Air percale",
    "Everyday percale",
    "Linen blend",
    "Soft sateen",
    "Deep percale",
    "Simple cotton",
  ].map((name, i): Product => ({
    id: `BED-00${i + 1}`,
    category: "bedsheets",
    brand: "Along Studio",
    model: name,
    variantId: `Queen · 152 × 203 cm · ${i === 4 ? 40 : 30} cm pocket`,
    title: `${name} sheet set`,
    image: image("bedding", name),
    specs: {
      Dimensions: "152 × 203 cm",
      "Mattress depth": i === 4 ? "40 cm" : "30 cm",
      Composition: i === 2 ? "55% linen / 45% cotton" : "100% cotton",
      Includes: "Fitted sheet + 2 pillowcases",
      Care: "Machine wash 30°C; line dry",
    },
    limitations: [
      "Synthetic textile specification. No cooling or health guarantee; check exact mattress dimensions.",
    ],
    evidenceIds: [`BED-00${i + 1}-spec`, `BED-00${i + 1}-reviews`],
    referencePriceMinor: [7900, 5900, 10900, 6900, 8900, 4900][i],
    availability: "in_stock",
    classification: "proxy",
  })),
];
const urls: Record<string, string> = {
  "MIC-001": "https://www.target.com/p/-/A-89827259",
  "MIC-003": "https://www.logitech.com/en-us/shop/p/h390-usb-headset",
  "MIC-009":
    "https://www.jabra.com/business/office-headsets/jabra-evolve/jabra-evolve2-65-flex",
  "MIC-015":
    "https://www.sweetwater.com/store/detail/MV6G2K--shure-mv6-gen-2-usb-gaming-microphone-black",
  "MIC-020":
    "https://fifinemicrophone.com/collections/microphones/products/fifine-ampligame-am8-microphone",
  "MIC-022":
    "https://www.sweetwater.com/store/detail/NTUSBMini--rode-nt-usb-mini-usb-condenser-microphone/reviews",
  "MIC-025":
    "https://www.logitechg.com/en-us/shop/p/snowball-ice-usb-microphone",
  "MIC-037":
    "https://www.sweetwater.com/store/detail/LavalierGO--rode-lavalier-go-professional-wearable-microphone/reviews",
  "MIC-038": "https://store.dji.com/product/dji-mic-mini",
  "MIC-040":
    "https://www.sweetwater.com/store/detail/WirelessME--rode-wireless-me-clip-on-wireless-microphone-system/reviews",
  "MIC-044":
    "https://www.sweetwater.com/store/detail/VideoMicGo2H--rode-videomic-go-ii-camera-mounted-shotgun-microphone/reviews",
  "MIC-047": "https://shop.deitymic.com/products/d4-mini",
};
const metrics: Record<string, [number | null, number | null, string, string]> =
  {
    "MIC-001": [
      4.35,
      1038,
      "Target product aggregate; exact variant grouping unverified.",
      "No written synthesis captured.",
    ],
    "MIC-020": [
      4.8,
      184,
      "Brand-store aggregate; variant grouping unverified.",
      "No written synthesis captured.",
    ],
    "MIC-022": [
      4.7,
      22,
      "Rendered customer reviews.",
      "Praise for clear sound, compact design and magnetic stand; some reports of disappointing sound or gain. Café dictation is unmeasured.",
    ],
    "MIC-037": [
      5,
      7,
      "Rendered customer reviews.",
      "Praise for small size and voice sound; self-noise and laptop combo-port compatibility are concerns.",
    ],
    "MIC-040": [
      4.8,
      4,
      "Rendered customer reviews.",
      "Praise for simple mobile setup; one report of relatively fast battery discharge.",
    ],
    "MIC-044": [
      5,
      2,
      "Rendered customer reviews.",
      "Two reviews praise audio and mounting; one says machinery noise was still captured.",
    ],
    "MIC-047": [
      null,
      43,
      "Shop review count; aggregate score unavailable.",
      "No written synthesis captured.",
    ],
  };
export const evidence: Evidence[] = products.flatMap((p) => {
  const m = metrics[p.id];
  return [
    {
      id: `${p.id}-spec`,
      subjectType: "product",
      subjectId: p.id,
      sourceUrl: urls[p.id] ?? null,
      sourceType:
        p.category === "audio"
          ? "Research seed · product specification"
          : "Authored demonstration specification",
      checkedOn: "2026-10-24",
      classification: p.classification,
      claim: Object.values(p.specs).join(". "),
    } as Evidence,
    {
      id: `${p.id}-reviews`,
      subjectType: "product",
      subjectId: p.id,
      sourceUrl: m ? urls[p.id] : null,
      sourceType: "Customer review snapshot",
      checkedOn: "2026-10-24",
      classification: p.category === "audio" ? "snapshot" : "proxy",
      claim:
        m?.[3] ??
        "Review synthesis not available. No customer reviews were invented.",
      rating: m?.[0] ?? null,
      ratingCount: p.id === "MIC-047" ? null : (m?.[1] ?? null),
      writtenReviewCount:
        p.id === "MIC-047"
          ? 43
          : m?.[2] === "Rendered customer reviews."
            ? m[1]
            : null,
      purchaseCount: null,
      purchaseCountPeriod: null,
      reviewScope: m?.[2] ?? "Not available",
    } as Evidence,
    ...(p.category === "bedsheets"
      ? []
      : [
          {
            id: `${p.id}-video`,
            subjectType: "product",
            subjectId: p.id,
            sourceUrl: null,
            sourceType: "Original demo explainer · not a product test",
            checkedOn: "2026-10-24",
            classification: "proxy",
            claim:
              "Illustrates placement or packing principles; does not demonstrate this product’s measured performance.",
            media: {
              url: p.category === "audio" ? "/canvas/placement.webm" : null,
              captionsUrl: "/canvas/placement.vtt",
              title:
                p.category === "audio"
                  ? "Why microphone placement matters"
                  : "Bag packing demonstration unavailable",
              creator: "Along demo team",
              takeaway:
                p.category === "audio"
                  ? "Keep the microphone close. Directionality alone cannot eliminate nearby speech; test your own dictation setup."
                  : "No playable bag demonstration is available.",
            },
          } as Evidence,
        ]),
  ];
});
export const offers: Offer[] = products.flatMap((p) =>
  ["cheap", "fast", "unknown"].map((kind, i): Offer => ({
    id: `${p.id}-${kind}`,
    productId: p.id,
    variantId: p.variantId,
    sellerId: `Demo seller ${["A", "B", "C"][i]}`,
    currency: "USD",
    unitPriceMinor:
      i === 0
        ? Math.max(0, p.referencePriceMinor! - 1000)
        : p.referencePriceMinor,
    shippingMinor: [500, 1000, null][i],
    otherFeesMinor: i === 2 ? null : 0,
    requiredSetupMinor: p.category === "audio" ? null : 0,
    availability: "in_stock",
    destination: "DEMO-DESTINATION",
    deliveryWindow: { latestOffsetDays: [3, 1, null][i] },
    returnTerms: "14-day demo returns",
    conditions: [
      "Synthetic fulfillment fixture; no live inventory or delivery check.",
      p.category === "audio"
        ? "Host compatibility and required adapters, cables or mounts are not yet verified or priced; a complete setup total is unavailable."
        : "No additional setup hardware is required in this synthetic fixture.",
    ],
    evidenceIds: [`${p.id}-${kind}-seller`],
    classification: "proxy",
  })),
);
for (const offer of offers)
  evidence.push({
    id: offer.evidenceIds[0],
    subjectType: "seller",
    subjectId: offer.sellerId,
    sourceUrl: null,
    sourceType: "Synthetic seller fixture",
    checkedOn: "2026-10-24",
    classification: "proxy",
    claim:
      "Seller history and verification are unavailable. Return conditions are demonstration data, separate from product reviews.",
  });
export const fixtureData: CanvasData = { products, evidence, offers };
