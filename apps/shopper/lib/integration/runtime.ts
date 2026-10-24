import {
  AuthoritativeSessionStore,
  GptLiveVoiceAdapter,
  VoiceOrchestrator,
} from "@coupang/agent";

const globalForAgent = globalThis as unknown as {
  __alongShopperStore?: AuthoritativeSessionStore;
  __alongShopperOrch?: VoiceOrchestrator;
  __alongShopperVoice?: GptLiveVoiceAdapter;
};

export function getRuntime() {
  if (!globalForAgent.__alongShopperStore) {
    globalForAgent.__alongShopperStore = new AuthoritativeSessionStore();
    globalForAgent.__alongShopperVoice = new GptLiveVoiceAdapter(
      process.env.OPENAI_API_KEY,
    );
    globalForAgent.__alongShopperOrch = new VoiceOrchestrator(
      globalForAgent.__alongShopperStore,
      globalForAgent.__alongShopperVoice,
    );
  }
  return {
    store: globalForAgent.__alongShopperStore!,
    orch: globalForAgent.__alongShopperOrch!,
    voice: globalForAgent.__alongShopperVoice!,
  };
}
