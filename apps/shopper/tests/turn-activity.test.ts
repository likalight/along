import { expect, it } from "vitest";
import {
  beginActivity,
  readActivity,
  updateActivity,
} from "@/lib/integration/activity";

it("ignores updates from replaced turns and never restarts completed or cancelled progress", () => {
  const session = crypto.randomUUID();
  beginActivity(session, 1, "old");
  beginActivity(session, 1, "new");
  updateActivity(session, 1, "old", { label: "Obsolete", phase: "done" });
  expect(readActivity(session, 1, "new")?.phase).toBe("working");
  expect(readActivity(session, 1, "old")).toBeNull();
  updateActivity(session, 1, "new", { phase: "done", label: "Stopped." });
  updateActivity(session, 1, "new", {
    phase: "working",
    label: "Late progress",
  });
  expect(readActivity(session, 1, "new")).toMatchObject({
    phase: "done",
    label: "Stopped.",
  });
  expect(readActivity(session, 2, "new")).toBeNull();
});
