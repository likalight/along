/** Public progress only: never model reasoning, tool arguments, or provider data. */
export interface TurnActivity {
  turnId: string;
  phase: "working" | "speaking" | "done" | "error";
  label: string;
  heading: string;
}
type Entry = TurnActivity & { epoch: number };
const root = globalThis as unknown as {
  __alongActivities?: Map<string, Entry>;
  __alongHeadings?: Map<string, string>;
};
const activities = (root.__alongActivities ??= new Map<string, Entry>());
export const turnHeadings = (root.__alongHeadings ??= new Map<
  string,
  string
>());

export function beginActivity(
  sessionId: string,
  epoch: number,
  turnId: string,
) {
  activities.set(sessionId, {
    epoch,
    turnId,
    phase: "working",
    label: "I’m on it. Looking at your request…",
    heading: "Let’s look into that.",
  });
}
export function updateActivity(
  sessionId: string,
  epoch: number,
  turnId: string,
  update: Partial<Pick<TurnActivity, "phase" | "label" | "heading">>,
) {
  const current = activities.get(sessionId);
  if (
    !current ||
    current.epoch !== epoch ||
    current.turnId !== turnId ||
    current.phase === "done" ||
    current.phase === "error"
  )
    return;
  activities.set(sessionId, { ...current, ...update });
}
export function readActivity(
  sessionId: string,
  epoch: number,
  turnId: string,
): TurnActivity | null {
  const current = activities.get(sessionId);
  if (!current || current.epoch !== epoch || current.turnId !== turnId)
    return null;
  const { epoch: _epoch, ...publicActivity } = current;
  return publicActivity;
}
