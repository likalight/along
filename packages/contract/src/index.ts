export * from "./types.js";
export * from "./discovery.js";

/** Voice adapter choice for this workstream — providers remain operationally open in #2. */
export const VOICE_ADAPTER = {
  id: "gpt-live",
  model: "gpt-realtime",
  transport: "webrtc",
  delegation: "client",
  duplex: true,
  notes:
    "GPT-Live duplex via OpenAI Realtime GA client secrets (POST /v1/realtime/client_secrets).",
} as const;

export {agreedCatalog} from "./catalog.generated.js";
