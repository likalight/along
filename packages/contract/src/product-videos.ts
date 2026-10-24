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
export type ProductVideoRequest = ProductVideo & { requestId: string };
