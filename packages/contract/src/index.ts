export * from "./types.js";

/** Voice adapter choice for this workstream — providers remain operationally open in #2. */
export const VOICE_ADAPTER = {
  id: "gpt-live",
  model: "gpt-live-1",
  transport: "webrtc",
  delegation: "client",
  duplex: true,
  notes:
    "Proposed agentic voice adapter. AFK work uses deterministic substitutes; live credentials TBD.",
} as const;

export {agreedCatalog} from "./catalog.generated.js";
