/** Curated outbound links. These are not hosted media or performance evidence. */
export const PRODUCT_VIDEOS = [
  {
    id: "rode-wireless-pro-review",
    productId: "MIC-062",
    title: "Rode Wireless Pro — Review & Audio Test",
    creator: "DansTubeTV",
    url: "https://www.youtube.com/shorts/WCsWHqMdPJI",
    checkedOn: "2026-10-25",
    notice:
      "External creator review. The title and product identity were checked; claims and crowded-room performance are not independently verified.",
  },
] as const;
export type ProductVideo = (typeof PRODUCT_VIDEOS)[number];
export type ProductVideoRequest = ProductVideo & {
  requestId: string;
  requestedProductId?: string;
  destination?: "inline" | "chrome";
};

/** Same product first; the presenter's approved related microphone review otherwise.
 * The UI must label a related model and must not change the shopping selection. */
export function productReview(
  productId: string | null | undefined,
): ProductVideo | undefined {
  return (
    PRODUCT_VIDEOS.find((video) => video.productId === productId) ??
    (productId?.startsWith("MIC-") ? PRODUCT_VIDEOS[0] : undefined)
  );
}

/** Destination intent only; never accepts a URL supplied by the page or model. */
export function requestsYouTubeReview(text: string): boolean {
  const words = text.trim().toLowerCase();
  if (
    /\b(?:don['’]?t|do not|not|never|instead of|rather than|what happens|if i say)\b/.test(
      words,
    )
  )
    return false;
  return /^(?:please |can you |could you |i want to |i would like to |i['’]d like to |let['’]s )?(?:take me|go|switch|open|return|bring me|watch|see|show)(?:\b.*)?\b(?:youtube|chrome)\b[^?]*[?]?$/.test(
    words,
  );
}
