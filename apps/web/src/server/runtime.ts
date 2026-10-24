import {
  FixtureSessionStore,
  GptLiveVoiceAdapter,
  VoiceOrchestrator,
} from "@coupang/agent";

const globalForAgent = globalThis as unknown as {
  __coupangStore?: FixtureSessionStore;
  __coupangOrch?: VoiceOrchestrator;
  __coupangVoice?: GptLiveVoiceAdapter;
};

export function getRuntime() {
  if (!globalForAgent.__coupangStore) {
    globalForAgent.__coupangStore = new FixtureSessionStore();
    globalForAgent.__coupangVoice = new GptLiveVoiceAdapter(
      process.env.OPENAI_API_KEY,
    );
    globalForAgent.__coupangOrch = new VoiceOrchestrator(
      globalForAgent.__coupangStore,
      globalForAgent.__coupangVoice,
    );
  }
  return {
    store: globalForAgent.__coupangStore!,
    orch: globalForAgent.__coupangOrch!,
    voice: globalForAgent.__coupangVoice!,
  };
}
