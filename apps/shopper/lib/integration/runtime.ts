import { beginActivity, readActivity, updateActivity } from "./activity";
import {
  AuthoritativeSessionStore,
  GptLiveVoiceAdapter,
  VoiceOrchestrator,
  type OpenEndedAgentConfig,
} from "@coupang/agent";

const globalForAgent = globalThis as unknown as {
  __alongNarrationSegments?: Map<
    string,
    {
      turnId: string;
      revision: number;
      segments: Array<{ text: string; productId: string | null }>;
    }
  >;
  __alongShopperStore?: AuthoritativeSessionStore;
  __alongShopperOrch?: VoiceOrchestrator;
  __alongShopperVoice?: GptLiveVoiceAdapter;
};

export const narrationSegments = (globalForAgent.__alongNarrationSegments ??=
  new Map<
    string,
    {
      turnId: string;
      revision: number;
      segments: Array<{ text: string; productId: string | null }>;
    }
  >());

function modelOverrides(): Pick<
  OpenEndedAgentConfig,
  "model" | "reasoningEffort" | "serviceTier"
> {
  const effort = process.env.ALONG_AGENT_REASONING_EFFORT;
  const allowed = ["none", "low", "medium", "high", "xhigh", "max"];
  if (effort && !allowed.includes(effort))
    throw new Error("invalid_agent_reasoning_effort");
  const serviceTier = process.env.ALONG_AGENT_SERVICE_TIER?.trim();
  if (
    serviceTier &&
    !["auto", "default", "fast", "priority"].includes(serviceTier)
  )
    throw new Error("invalid_agent_service_tier");
  return {
    model: process.env.ALONG_AGENT_MODEL?.trim() || undefined,
    reasoningEffort: effort as OpenEndedAgentConfig["reasoningEffort"],
    serviceTier: (serviceTier ||
      undefined) as OpenEndedAgentConfig["serviceTier"],
  };
}

export function getRuntime() {
  if (!globalForAgent.__alongShopperStore) {
    globalForAgent.__alongShopperStore = new AuthoritativeSessionStore();
    globalForAgent.__alongShopperVoice = new GptLiveVoiceAdapter(
      process.env.OPENAI_API_KEY,
    );
    globalForAgent.__alongShopperOrch = new VoiceOrchestrator(
      globalForAgent.__alongShopperStore,
      globalForAgent.__alongShopperVoice,
      // Browser regressions run a real development server with an explicit
      // fixture mode. Never infer offline mode from a missing provider key,
      // and never enable it in a production server.
      (process.env.NODE_ENV === "test" &&
        process.env.ALONG_AGENT_MODE !== "live") ||
        (process.env.NODE_ENV === "development" &&
          process.env.ALONG_AGENT_MODE === "fixture")
        ? undefined
        : {
            agent: {
              apiKey: process.env.OPENAI_API_KEY ?? "",
              ...modelOverrides(),
              onActivity: ({ sessionId, epoch, turnId, label }) => {
                const current =
                  globalForAgent.__alongShopperStore?.core.get(sessionId);
                if (current?.epoch === epoch && current.turn?.id === turnId) {
                  if (!readActivity(sessionId, epoch, turnId))
                    beginActivity(sessionId, epoch, turnId);
                  updateActivity(sessionId, epoch, turnId, {
                    phase: "working",
                    label,
                    heading: label.replace(/…$/, "."),
                  });
                }
              },
            },
          },
    );
  }
  return {
    store: globalForAgent.__alongShopperStore!,
    orch: globalForAgent.__alongShopperOrch!,
    voice: globalForAgent.__alongShopperVoice!,
  };
}
