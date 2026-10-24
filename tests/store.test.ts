import { describe, it, expect } from "vitest";
import {
  accept,
  addAsset,
  cancel,
  connect,
  Conflict,
  lifecycle,
  setMode,
} from "@/lib/session/store";
import { preparedImage } from "@/lib/session/fixtures";
import type { Identity, Input, Session } from "@/lib/session/contract";
let sequence = 0;
function input(
  s: Session,
  text: string,
  modality: "voice" | "text" = "text",
): Input {
  return {
    sessionId: s.sessionId,
    epoch: s.epoch,
    turnId: `turn-${++sequence}`,
    eventId: `event-${sequence}`,
    baseRevision: s.revision,
    visibleRevision: s.revision,
    visibleProductIds: s.displayOrder,
    modality,
    text,
  };
}
function identity(s: Session, turnId = "mode"): Identity {
  return {
    sessionId: s.sessionId,
    epoch: s.epoch,
    revision: s.revision,
    turnId,
  };
}
function bagSummary(mode: "voice" | "text" = "text") {
  let s = connect();
  s = setMode(identity(s), mode);
  s = accept(input(s, "a work bag", mode)).snapshot;
  const turn = input(s, "choose faster offer", mode),
    event = accept(turn);
  return { s: event.snapshot, turn };
}
describe("authoritative fixture session", () => {
  it("uses the same accepted-state path for voice and text across the complete journey", () => {
    for (const mode of ["voice", "text"] as const) {
      let s = connect();
      s = setMode(identity(s), mode);
      for (const [command, view] of [
        ["cafe dictation", "solution_types"],
        ["choose headset", "buying_priorities"],
        ["best value", "shortlist"],
        ["compare", "comparison"],
        ["show option 1", "shortlist"],
        ["show evidence", "evidence"],
        ["show offers", "offers"],
        ["choose faster offer", "summary"],
      ] as const) {
        s = accept(input(s, command, mode)).snapshot;
        expect(s.view).toBe(view);
      }
      expect(s.summary?.totalMinor).toBe(9900);
    }
  });
  it("rejects stale revisions, epochs, cancelled turns and unknown assets without changing accepted state", () => {
    const s = connect(),
      i = input(s, "bag");
    cancel({ ...identity(s), turnId: i.turnId });
    expect(() => accept(i)).toThrow(Conflict);
    expect(() => accept({ ...i, turnId: "new", epoch: 2 })).toThrow(Conflict);
    expect(() => accept({ ...input(s, "bag"), baseRevision: 9 })).toThrow(
      Conflict,
    );
    expect(() =>
      accept({ ...input(s, "bag"), attachmentId: "forged" }),
    ).toThrow("Unknown attachment");
    expect(connect(s.sessionId).revision).toBe(0);
  });
  it("deduplicates input events", () => {
    const s = connect(),
      i = input(s, "bag");
    expect(accept(i)).toEqual(accept(i));
    expect(connect(s.sessionId).revision).toBe(1);
  });
  it("requires uninterrupted full playback and matching identity before voice approval", () => {
    const { s, turn } = bagSummary("voice");
    expect(() =>
      accept(input(s, "confirm simulated purchase", "voice")),
    ).toThrow(Conflict);
    const audio = {
      ...identity(s, turn.turnId),
      playbackId: "play-1",
      summaryId: s.summaryId!,
    };
    lifecycle({ ...audio, type: "audio.started" });
    lifecycle({ ...audio, playbackId: "old", type: "audio.completed" });
    expect(connect(s.sessionId).approvalStatus).toBe("presenting");
    lifecycle({ ...audio, type: "audio.completed" });
    expect(connect(s.sessionId).approvalStatus).toBe("eligible");
    const confirmed = accept(
      input(s, "confirm simulated purchase", "voice"),
    ).snapshot;
    expect(confirmed.receipt?.simulated).toBe(true);
  });
  it("interruption invalidates voice summary; stale completion cannot restore eligibility", () => {
    const { s, turn } = bagSummary("voice");
    const audio = {
      ...identity(s, turn.turnId),
      playbackId: "p",
      summaryId: s.summaryId!,
    };
    lifecycle({ ...audio, type: "audio.started" });
    cancel(identity(s, turn.turnId));
    lifecycle({ ...audio, type: "audio.completed" });
    expect(() =>
      accept(input(s, "confirm simulated purchase", "voice")),
    ).toThrow(Conflict);
  });
  it("requires full current summary redisplay when explicitly choosing text confirmation", () => {
    const { s, turn } = bagSummary("voice");
    const switched = setMode(identity(s, turn.turnId), "text");
    expect(switched.summary?.presentationMode).toBe("text");
    expect(switched.summary?.revision).toBe(switched.revision);
    expect(switched.message).toContain("Total USD 99.00");
    expect(() => accept(input(s, "confirm simulated purchase"))).toThrow(
      Conflict,
    );
    expect(
      accept(input(switched, "confirm simulated purchase")).snapshot.view,
    ).toBe("receipt");
  });
  it("does not treat vague assent, photo/link text or audio failure as approval", () => {
    for (const modality of ["image", "link"] as const) {
      const { s } = bagSummary();
      const asset = addAsset(s.sessionId, preparedImage);
      const i = {
        ...input(s, "confirm simulated purchase"),
        modality,
        attachmentId: asset.id,
      };
      expect(accept(i).snapshot.receipt).toBeNull();
    }
    const { s } = bagSummary();
    expect(accept(input(s, "looks good")).snapshot.receipt).toBeNull();
  });
  it("returns one immutable receipt for duplicate and concurrent approval submissions", () => {
    const { s } = bagSummary(),
      i = input(s, "confirm simulated purchase"),
      first = accept(i);
    expect(accept(i).snapshot.receipt).toEqual(first.snapshot.receipt);
    expect(() => accept(input(s, "confirm simulated purchase"))).toThrow(
      Conflict,
    );
    const latest = connect(s.sessionId);
    expect(
      accept(input(latest, "confirm simulated purchase")).snapshot.receipt,
    ).toEqual(first.snapshot.receipt);
  });
  it("retains complete summary after completed narration when a new approval turn starts", () => {
    const { s, turn } = bagSummary("voice");
    const audio = {
      ...identity(s, turn.turnId),
      playbackId: "p",
      summaryId: s.summaryId!,
    };
    lifecycle({ ...audio, type: "audio.started" });
    lifecycle({ ...audio, type: "audio.completed" });
    cancel(identity(s, turn.turnId));
    expect(
      accept(input(connect(s.sessionId), "confirm simulated purchase", "voice"))
        .snapshot.receipt,
    ).not.toBeNull();
  });
  it("removes an accepted attachment through the same turn path", () => {
    let s = connect();
    const a = addAsset(s.sessionId, preparedImage);
    s = accept({
      ...input(s, ""),
      modality: "image",
      attachmentId: a.id,
    }).snapshot;
    expect(s.attachmentIds).toContain(a.id);
    s = accept(input(s, `Remove reference ${a.id}`)).snapshot;
    expect(s.attachmentIds).not.toContain(a.id);
  });
  it("reconnect returns a snapshot without replaying actions or receipt creation", () => {
    const { s } = bagSummary();
    expect(connect(s.sessionId)).toEqual(s);
    expect(connect(s.sessionId).receipt).toBeNull();
  });
});
