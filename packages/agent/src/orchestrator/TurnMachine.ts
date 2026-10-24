export type TurnStatus = "active" | "completed" | "cancelled";

export interface TurnMeta {
  turnId: string;
  delegationId?: string;
  basedOnRevisionId: number;
  status: TurnStatus;
  cancelToken: AbortController;
  startedAt: number;
}

/** Owns turn identity, cancel tokens, and stale-result discard (Factor 8). */
export class TurnMachine {
  private current: TurnMeta | null = null;
  private history: TurnMeta[] = [];

  beginTurn(opts: {
    turnId: string;
    basedOnRevisionId: number;
    delegationId?: string;
  }): TurnMeta {
    if (this.current?.status === "active") {
      this.cancel(this.current.turnId, "superseded");
    }
    const turn: TurnMeta = {
      turnId: opts.turnId,
      basedOnRevisionId: opts.basedOnRevisionId,
      delegationId: opts.delegationId,
      status: "active",
      cancelToken: new AbortController(),
      startedAt: Date.now(),
    };
    this.current = turn;
    this.history.push(turn);
    return turn;
  }

  cancel(turnId: string, reason: string): TurnMeta | null {
    const turn =
      this.current?.turnId === turnId
        ? this.current
        : this.history.find((t) => t.turnId === turnId);
    if (!turn || turn.status !== "active") return null;
    turn.status = "cancelled";
    turn.cancelToken.abort(reason);
    if (this.current?.turnId === turnId) {
      this.current = turn;
    }
    return turn;
  }

  complete(turnId: string): TurnMeta | null {
    if (!this.current || this.current.turnId !== turnId) return null;
    if (this.current.status !== "active") return null;
    this.current.status = "completed";
    return this.current;
  }

  get active(): TurnMeta | null {
    return this.current?.status === "active" ? this.current : null;
  }

  /** Drop results from cancelled turns or mismatched revisions. */
  shouldAcceptResult(
    turnId: string,
    basedOnRevisionId: number,
    currentRevision: number,
  ): boolean {
    const turn =
      this.current?.turnId === turnId
        ? this.current
        : this.history.find((t) => t.turnId === turnId);
    if (!turn) return false;
    if (turn.status === "cancelled") return false;
    if (turn.basedOnRevisionId !== basedOnRevisionId) return false;
    if (basedOnRevisionId !== currentRevision) return false;
    return turn.status === "active";
  }
}
