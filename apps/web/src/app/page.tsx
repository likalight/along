import { HarnessConsole } from "@/components/HarnessConsole";

export default function HomePage() {
  return (
    <main
      style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}
    >
      <p
        style={{
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted)",
          fontSize: 12,
        }}
      >
        Coupang challenge · agentic harness
      </p>
      <h1
        style={{
          fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
          margin: "0.4rem 0 0.6rem",
        }}
      >
        Along integration rehearsal
      </h1>
      <p
        style={{
          color: "var(--muted)",
          maxWidth: 620,
          lineHeight: 1.5,
          marginTop: 0,
        }}
      >
        Shared catalog, deterministic text orchestration, and authoritative
        purchase checks. This is a team integration console; live voice and the
        final shopper interface are pending.
      </p>
      <HarnessConsole />
    </main>
  );
}
