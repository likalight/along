"use client";
import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { VoiceStatus } from "@/lib/session/contract";
import { voiceOrbState } from "@/lib/voice/orb-state";
const Orb = dynamic(() => import("./ui/orb").then((m) => m.Orb), {
  ssr: false,
  loading: () => <div className="orb-fallback" />,
});
class OrbBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="orb-fallback" />
    ) : (
      this.props.children
    );
  }
}
export function VoiceOrb({
  status,
  capturing,
  compact,
}: {
  status: VoiceStatus;
  capturing: boolean;
  compact: boolean;
}) {
  const reduced = useReducedMotion();
  const [webgl, setWebgl] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = wrapper.current;
    const lost = () => setWebgl(false);
    element?.addEventListener("webglcontextlost", lost, true);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      setWebgl(!!gl);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setWebgl(false);
    }
    return () => element?.removeEventListener("webglcontextlost", lost, true);
  }, []);
  // Keep the ElevenLabs orb mounted whenever WebGL is available — idle still
  // shows the blue orb (agentState null). CSS fallback is only for reduced
  // motion / no WebGL / boundary failure, not for "not currently talking".
  return (
    <div
      ref={wrapper}
      className={`orb-wrap ${compact ? "compact" : ""} ${capturing ? "capturing" : ""}`}
      aria-hidden="true"
      data-status={status}
    >
      {webgl && !reduced ? (
        <OrbBoundary>
          <div className="orb-canvas">
            <Orb
              className="orb-canvas"
              seed={73}
              colors={["#155bd5", "#86bbff"]}
              volumeMode="auto"
              agentState={voiceOrbState(status, capturing)}
            />
          </div>
        </OrbBoundary>
      ) : (
        <div className="orb-fallback" />
      )}
    </div>
  );
}
