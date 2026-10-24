import { HarnessConsole } from "@/components/HarnessConsole";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
      <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", fontSize: 12 }}>
        Coupang challenge · agentic harness
      </p>
      <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", margin: "0.4rem 0 0.6rem" }}>
        GPT-Live multimodal harness
      </h1>
      <p style={{ color: "var(--muted)", maxWidth: 62, lineHeight: 1.5, marginTop: 0 }}>
        Custom contract-v1 agent loop with full-duplex voice adapter. Typing still gets spoken
        replies. Issues #10–#13.
      </p>
      <HarnessConsole />
    </main>
  );
}
