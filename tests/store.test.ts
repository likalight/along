import { describe, it, expect, vi } from "vitest";
import {
  accept,
  addAsset,
  cancel,
  connect,
  Conflict,
  lifecycle,
  setMode,
  removeAsset,
} from "@/lib/session/store";
import { preparedImage } from "@/lib/session/fixtures";
import type {
  Identity,
  Input,
  Session,
  Lifecycle,
} from "@/lib/session/contract";
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
  s = display(event.snapshot);
  return { s, turn };
}
function display(s: Session) {
  return lifecycle({
    ...identity(s),
    playbackId: "display",
    summaryId: s.summaryId!,
    summaryRevision: s.summary!.revision,
    type: "summary.displayed",
  });
}
function play(event: Lifecycle) {
  return lifecycle({ ...event, revision: connect(event.sessionId).revision });
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
      summaryRevision: s.summary!.revision,
    };
    play({ ...audio, type: "audio.started" });
    play({ ...audio, playbackId: "old", type: "audio.completed" });
    expect(connect(s.sessionId).approvalStatus).toBe("presenting");
    play({ ...audio, type: "audio.completed" });
    expect(connect(s.sessionId).approvalStatus).toBe("eligible");
    const confirmed = accept(
      input(connect(s.sessionId), "confirm simulated purchase", "voice"),
    ).snapshot;
    expect(confirmed.receipt?.simulated).toBe(true);
  });
  it("interruption invalidates voice summary; stale completion cannot restore eligibility", () => {
    const { s, turn } = bagSummary("voice");
    const audio = {
      ...identity(s, turn.turnId),
      playbackId: "p",
      summaryId: s.summaryId!,
      summaryRevision: s.summary!.revision,
    };
    play({ ...audio, type: "audio.started" });
    cancel(identity(s, turn.turnId));
    lifecycle({ ...audio, type: "audio.completed" });
    expect(() =>
      accept(input(s, "confirm simulated purchase", "voice")),
    ).toThrow(Conflict);
  });
  it("requires full current summary redisplay when explicitly choosing text confirmation", () => {
    const { s, turn } = bagSummary("voice");
    let switched = setMode(identity(s, turn.turnId), "text");
    expect(switched.summary?.presentationMode).toBe("text");
    expect(switched.summary?.revision).toBe(switched.revision);
    expect(switched.message).toContain("Total USD 99.00");
    expect(switched.approvalStatus).toBe("presenting");
    expect(() => accept(input(s, "confirm simulated purchase"))).toThrow(
      Conflict,
    );
    expect(() => accept(input(switched, "confirm simulated purchase"))).toThrow(
      Conflict,
    );
    switched = display(switched);
    expect(
      accept(input(switched, "confirm simulated purchase")).snapshot.view,
    ).toBe("receipt");
  });
  it("does not treat vague assent, photo/link text or audio failure as approval", () => {
    for (const modality of ["image", "link"] as const) {
      const { s } = bagSummary();
      const asset = addAsset(s.sessionId, { ...preparedImage, kind: modality });
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
      summaryRevision: s.summary!.revision,
    };
    play({ ...audio, type: "audio.started" });
    play({ ...audio, type: "audio.completed" });
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
  it("rejects changed-payload event reuse and turn reuse without changing the current snapshot", () => {
    const start = connect(),
      i = input(start, "bag");
    const accepted = accept(i).snapshot;
    expect(() => accept({ ...i, text: "bedsheets" })).toThrow(Conflict);
    expect(() =>
      accept({ ...input(accepted, "best value"), turnId: i.turnId }),
    ).toThrow(Conflict);
    expect(connect(start.sessionId)).toEqual(accepted);
  });
  it("rejects stale mode mutations and mismatched visible order", () => {
    const start = connect();
    let s = accept(input(start, "bag")).snapshot;
    s = accept(input(s, "show options")).snapshot;
    expect(() => setMode(identity(start), "voice")).toThrow(Conflict);
    expect(() =>
      accept({
        ...input(s, "second"),
        visibleProductIds: [...s.displayOrder].reverse(),
      }),
    ).toThrow(Conflict);
    expect(connect(s.sessionId)).toEqual(s);
  });
  it("resolves ordinal references only against displayed product identities and clarifies absent/ambiguous options", () => {
    let s = connect();
    s = accept(input(s, "bag")).snapshot;
    s = accept(input(s, "show options")).snapshot;
    const secondId = s.displayOrder[1];
    s = accept(input(s, "show second")).snapshot;
    expect(s.focusedProductId).toBe(secondId);
    expect(() => accept(input(s, "show second"))).toThrow(
      "current displayed choices",
    );
    expect(() => accept(input(s, "first and second"))).toThrow(
      "current displayed choices",
    );
    expect(connect(s.sessionId)).toEqual(s);
    s = accept(input(s, "show first")).snapshot;
    expect(s.focusedProductId).toBe(secondId);
  });
  it("requires rendered summary acknowledgement and exact summary revision independently of audio", () => {
    let s = connect();
    s = setMode(identity(s), "voice");
    s = accept(input(s, "bag", "voice")).snapshot;
    const turn = input(s, "choose faster offer", "voice");
    s = accept(turn).snapshot;
    const audio = {
      ...identity(s, turn.turnId),
      playbackId: "p",
      summaryId: s.summaryId!,
      summaryRevision: s.summary!.revision,
    };
    s = play({ ...audio, type: "audio.started" });
    s = play({ ...audio, type: "audio.completed" });
    expect(s.approvalStatus).toBe("presenting");
    expect(() =>
      accept(input(s, "confirm simulated purchase", "voice")),
    ).toThrow(Conflict);
    const wrong = lifecycle({
      ...identity(s),
      playbackId: "display",
      type: "summary.displayed",
      summaryId: s.summaryId!,
      summaryRevision: s.summary!.revision - 1,
    });
    expect(wrong).toEqual(s);
    s = display(s);
    expect(s.approvalStatus).toBe("eligible");
    expect(
      accept(input(s, "confirm simulated purchase", "voice")).snapshot.receipt
        ?.simulated,
    ).toBe(true);
  });
  it("cannot revive interrupted audio with a new start or stale completion", () => {
    const { s, turn } = bagSummary("voice");
    const audio = {
      ...identity(s, turn.turnId),
      playbackId: "p",
      summaryId: s.summaryId!,
      summaryRevision: s.summary!.revision,
    };
    play({ ...audio, type: "audio.started" });
    const interrupted = play({ ...audio, type: "audio.interrupted" });
    expect(interrupted.approvalStatus).toBe("not_prepared");
    expect(play({ ...audio, type: "audio.started" })).toEqual(interrupted);
    expect(play({ ...audio, type: "audio.completed" })).toEqual(interrupted);
  });
  it("spoken stop invalidates a typed summary and late approval cannot commit", () => {
    const { s } = bagSummary("text");
    const changed = setMode(identity(s), "voice");
    const stopped = accept(input(changed, "Stop!", "voice")).snapshot;
    expect(stopped.view).toBe("recovery");
    expect(stopped.summary).toBeNull();
    expect(() => accept(input(s, "confirm simulated purchase"))).toThrow(
      Conflict,
    );
    expect(connect(s.sessionId).receipt).toBeNull();
  });
  it("completed receipts remain immutable through later inputs, mode and audio callbacks", () => {
    const { s } = bagSummary();
    const i = input(s, "confirm simulated purchase"),
      accepted = accept(i).snapshot;
    expect(() => accept(input(accepted, "show options"))).toThrow(Conflict);
    expect(setMode(identity(accepted), "voice")).toEqual(accepted);
    const audio = {
      ...identity(accepted, i.turnId),
      playbackId: "receipt-audio",
      summaryId: accepted.summaryId!,
      summaryRevision: accepted.summary!.revision,
    };
    expect(lifecycle({ ...audio, type: "audio.started" })).toEqual(accepted);
    expect(lifecycle({ ...audio, type: "audio.completed" })).toEqual(accepted);
    accepted.receipt!.acceptedOrder.totalMinor = 1;
    expect(connect(s.sessionId).receipt!.acceptedOrder.totalMinor).toBe(9900);
  });
  it("removes pending assets, frees accepted asset capacity and expires assets with their session", () => {
    let s = connect();
    const pending = addAsset(s.sessionId, preparedImage);
    expect(removeAsset(s.sessionId, pending.id)).toBe(true);
    const asset = addAsset(s.sessionId, preparedImage);
    s = accept({
      ...input(s, ""),
      modality: "image",
      attachmentId: asset.id,
    }).snapshot;
    expect(removeAsset(s.sessionId, asset.id)).toBe(false);
    s = accept(input(s, `Remove reference ${asset.id}`)).snapshot;
    expect(() =>
      accept({ ...input(s, ""), modality: "image", attachmentId: asset.id }),
    ).toThrow("Unknown attachment");
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 3_600_001);
    try {
      expect(() => connect(s.sessionId)).toThrow("expired");
    } finally {
      clock.mockRestore();
    }
  });
});
