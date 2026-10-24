import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VOICE_ADAPTER } from "@coupang/contract";
import { completeTotalMinor, getOffer } from "./fixtures/catalog.js";
import { FORBIDDEN_TOOLS, isForbiddenTool } from "./gate/proposals.js";
import { routeInput, resolveReference } from "./intent/router.js";
import { VoiceOrchestrator } from "./orchestrator/VoiceOrchestrator.js";
import { FixtureSessionStore } from "./session/FixtureSessionStore.js";
import { FixtureVoiceAdapter } from "./voice/adapter.js";

describe("contract + voice adapter metadata", () => {
  it("documents GPT-Live as proposed duplex adapter", () => {
    assert.equal(VOICE_ADAPTER.id, "gpt-live");
    assert.equal(VOICE_ADAPTER.duplex, true);
    assert.equal(VOICE_ADAPTER.delegation, "client");
  });

  it("forbids purchase tools", () => {
    for (const t of FORBIDDEN_TOOLS) assert.equal(isForbiddenTool(t), true);
    assert.equal(isForbiddenTool("propose_approval"), false);
  });
});

describe("A1 multimodal turn orchestration (#10)", () => {
  it("cold start opens clarification with spoken output", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession({ scenarioId: null });

    const out = await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "e1",
      turnId: "t1",
      baseRevision: 0,
      modality: "voice",
      text: "hi",
      visibleRevision: 0,
      visibleProductIds: [],
    });

    assert.equal(out.cancelled, false);
    assert.ok(out.speakable.length >= 1);
    assert.ok(
      voice.log.some((l) => l.channel === "commentary" || l.channel === "thinking"),
    );
  });

  it("typed turns still produce spoken commentary", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession({ scenarioId: "cafe_dictation" });

    await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "e1",
      turnId: "t1",
      baseRevision: 0,
      modality: "text",
      text: "I need a clip-on mic for café dictation under $100",
      visibleRevision: 0,
      visibleProductIds: [],
    });

    assert.ok(voice.log.some((l) => l.content.startsWith("[user-inject]")));
    assert.ok(voice.log.some((l) => l.channel === "commentary"));
  });

  it("barge-in cancels active turn and interrupts voice", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession();
    orch.turns.beginTurn({ turnId: "old", basedOnRevisionId: 0 });
    await orch.bargeIn(session.sessionId, "old");
    assert.equal(orch.turns.active, null);
    assert.ok(voice.interrupted.some((x) => x.includes("barge_in")));
  });

  it("stop/defer is a valid outcome without receipt", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession();
    const out = await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "stop1",
      turnId: "t-stop",
      baseRevision: 0,
      modality: "voice",
      text: "stop, not now",
      visibleRevision: 0,
      visibleProductIds: [],
    });
    assert.notEqual(out.snapshot.approvalStatus, "approved");
    assert.match(
      out.speakable.map((s) => s.content).join(" "),
      /stop|purchase|problem/i,
    );
  });
});

describe("A2 guided priorities and shortlist (#11)", () => {
  it("audio path: solution type then priority then ranked shortlist", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession({ scenarioId: "cafe_dictation" });

    await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "a1",
      turnId: "t1",
      baseRevision: 0,
      modality: "voice",
      text: "directional desktop mic",
      visibleRevision: 0,
      visibleProductIds: [],
    });

    const mid = orch.getSnapshot(session.sessionId)!;
    const out = await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "a2",
      turnId: "t2",
      baseRevision: mid.revision,
      modality: "voice",
      text: "best value please",
      visibleRevision: mid.revision,
      visibleProductIds: mid.displayOrder,
    });

    assert.ok(out.snapshot.shortlistEntries.length <= 3);
    assert.ok(out.snapshot.shortlistEntries.length >= 1);
    assert.equal(out.snapshot.shortlistEntries[0]?.rank, "gold");
    assert.ok(out.snapshot.shortlistEntries[0]?.compromise);
    assert.notEqual(out.snapshot.buyingPriority, "lowest_cost_suitable");
  });

  it("resolves second ordinal against displayOrder", () => {
    const snap = {
      displayOrder: ["MIC-009", "MIC-040", "MIC-022"],
    } as Parameters<typeof resolveReference>[1];
    const r = resolveReference("the second one", snap, snap.displayOrder);
    assert.equal(r.productId, "MIC-040");
  });

  it("lowest-cost uses complete totals not unit price alone", () => {
    const cheap = getOffer("mic-040-cheap")!;
    const fast = getOffer("mic-040-fast")!;
    assert.ok(completeTotalMinor(cheap)! < completeTotalMinor(fast)!);
  });

  it("save does not approve", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession({ scenarioId: "cafe_dictation" });
    store.apply({
      sessionId: session.sessionId,
      epoch: 1,
      turnId: "seed",
      baseRevision: 0,
      eventId: "seed-sl",
      action: "shortlist",
      payload: {
        entries: [
          {
            productId: "MIC-040",
            rank: "gold",
            fitReason: "fit",
            compromise: "c",
          },
        ],
      },
      evidenceIds: [],
    });
    const rev = store.get(session.sessionId)!.revision;
    const out = await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "save1",
      turnId: "t-save",
      baseRevision: rev,
      modality: "voice",
      text: "save this",
      visibleRevision: rev,
      visibleProductIds: ["MIC-040"],
    });
    assert.equal(out.snapshot.savedItems.length, 1);
    assert.equal(out.snapshot.approvalStatus, "not_prepared");
  });
});

describe("A3 evidence and offers (#12)", () => {
  it("show_evidence keeps product vs seller evidence ids", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession({ scenarioId: "cafe_dictation" });
    store.apply({
      sessionId: session.sessionId,
      epoch: 1,
      turnId: "seed",
      baseRevision: 0,
      eventId: "seed-sl",
      action: "shortlist",
      payload: {
        entries: [
          {
            productId: "MIC-040",
            rank: "gold",
            fitReason: "fit",
            compromise: "c",
          },
        ],
      },
      evidenceIds: [],
    });
    const rev = store.get(session.sessionId)!.revision;
    const out = await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "ev1",
      turnId: "t-ev",
      baseRevision: rev,
      modality: "voice",
      text: "show reviews and seller feedback",
      visibleRevision: rev,
      visibleProductIds: ["MIC-040"],
    });
    assert.ok(out.snapshot.evidenceIds.some((id) => id.includes("product")));
    assert.ok(out.snapshot.evidenceIds.some((id) => id.includes("seller")));
    assert.equal(out.snapshot.view, "evidence");
  });

  it("video lifecycle pauses narration then resumes takeaway", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession();
    await orch.handleLifecycle({
      sessionId: session.sessionId,
      epoch: 1,
      turnId: "t",
      revision: 0,
      type: "video.started",
    });
    assert.ok(voice.videoPaused.has(session.sessionId));
    await orch.handleLifecycle({
      sessionId: session.sessionId,
      epoch: 1,
      turnId: "t",
      revision: 0,
      type: "video.stopped",
    });
    assert.equal(voice.videoPaused.has(session.sessionId), false);
    assert.ok(voice.log.some((l) => /takeaway|grounded/i.test(l.content)));
  });
});

describe("A4 image and links (#13)", () => {
  it("prepared image asks shape vs colour before hard constraints", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession({
      scenarioId: "bag_inspiration",
      preparedAttachmentId: "att-bag-navy-ref",
    });
    const out = await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "img1",
      turnId: "t-img",
      baseRevision: 0,
      modality: "image",
      attachmentId: "att-bag-navy-ref",
      visibleRevision: 0,
      visibleProductIds: [],
    });
    assert.match(
      out.speakable.map((s) => s.content).join(" "),
      /shape|colour|color/i,
    );
    assert.equal("shape" in out.snapshot.hardConstraints, false);
  });

  it("unknown link recovers without inventing products", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession();
    const out = await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "link1",
      turnId: "t-link",
      baseRevision: 0,
      modality: "link",
      text: "https://evil.example/not-mapped",
      visibleRevision: 0,
      visibleProductIds: [],
    });
    assert.match(
      out.speakable.map((s) => s.content).join(" "),
      /not|mapping|invent/i,
    );
    assert.equal(out.snapshot.shortlistIds.length, 0);
  });

  it("known link cites fixture mapping", async () => {
    const store = new FixtureSessionStore();
    const voice = new FixtureVoiceAdapter();
    const orch = new VoiceOrchestrator(store, voice);
    const session = orch.createSession({ scenarioId: "bag_inspiration" });
    const out = await orch.handleInput({
      sessionId: session.sessionId,
      epoch: 1,
      eventId: "link2",
      turnId: "t-link2",
      baseRevision: 0,
      modality: "link",
      text: "https://fixtures.local/ref/bag-001",
      visibleRevision: 0,
      visibleProductIds: [],
    });
    assert.ok(out.snapshot.shortlistIds.includes("BAG-001"));
  });
});

describe("routing helpers", () => {
  it("routes evidence questions", () => {
    const route = routeInput(
      {
        sessionId: "s",
        epoch: 1,
        eventId: "e",
        turnId: "t",
        baseRevision: 1,
        modality: "voice",
        text: "what do the reviews say?",
        visibleRevision: 1,
        visibleProductIds: ["MIC-040"],
      },
      {
        revision: 1,
        displayOrder: ["MIC-040"],
        imageInferences: [],
        scenarioId: "cafe_dictation",
        scenarioStage: "within_priority",
      } as never,
    );
    assert.equal(route, "evidence_q");
  });
});
