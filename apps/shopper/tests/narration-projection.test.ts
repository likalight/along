import {expect, it} from "vitest";
import {getRuntime, narrationSegments} from "@/lib/integration/runtime";
import {project, messages} from "@/lib/integration/projection";

it("projects narration only for the accepted turn, revision and exact spoken message", () => {
  const {store, orch} = getRuntime();
  const snapshot = orch.createSession();
  const sessionId = snapshot.sessionId;
  store.ingestInput({sessionId, epoch:snapshot.epoch, turnId:"narration-turn", eventId:crypto.randomUUID(), baseRevision:snapshot.revision, modality:"text", text:"Show bags", visibleRevision:snapshot.revision, visibleProductIds:[]});
  const revision = store.get(sessionId)!.revision;
  const segments = [{text:"Here are your options.", productId:null}];
  messages.set(sessionId, segments[0]!.text);
  const accepted = {turnId:"narration-turn", revision, segments};
  narrationSegments.set(sessionId, accepted);
  expect(project(sessionId).narrationSegments).toEqual(segments);
  narrationSegments.set(sessionId, {...accepted, turnId:"old-turn"});
  expect(project(sessionId).narrationSegments).toBeUndefined();
  narrationSegments.set(sessionId, {...accepted, revision:revision - 1});
  expect(project(sessionId).narrationSegments).toBeUndefined();
  narrationSegments.set(sessionId, accepted);
  messages.set(sessionId, "A newer answer.");
  expect(project(sessionId).narrationSegments).toBeUndefined();
  narrationSegments.delete(sessionId);
  messages.delete(sessionId);
});
