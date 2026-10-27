// Rank movement between Qloo's top 10 without and with taste signals (from `evidence` only).
import type { PlaceRef } from "./types";

export type Movement =
  | { kind: "up"; by: number }
  | { kind: "down"; by: number }
  | { kind: "same" }
  | { kind: "new" };

export interface MovementRow extends PlaceRef {
  /** 1-based position with taste signals. */
  rank: number;
  /** 1-based position without them, or null if not in the baseline top 10. */
  baselineRank: number | null;
  movement: Movement;
}

export function rankMovement(baseline: readonly PlaceRef[], personalised: readonly PlaceRef[]): MovementRow[] {
  const before = new Map(baseline.map((p, i) => [p.id, i + 1]));
  return personalised.map((p, i) => {
    const rank = i + 1;
    const baselineRank = before.get(p.id) ?? null;
    const movement: Movement =
      baselineRank === null
        ? { kind: "new" }
        : baselineRank > rank
          ? { kind: "up", by: baselineRank - rank }
          : baselineRank < rank
            ? { kind: "down", by: rank - baselineRank }
            : { kind: "same" };
    return { ...p, rank, baselineRank, movement };
  });
}

/** Baseline places that left the top 10 once taste signals were added. */
export function droppedOut(baseline: readonly PlaceRef[], personalised: readonly PlaceRef[]): PlaceRef[] {
  const now = new Set(personalised.map((p) => p.id));
  return baseline.filter((p) => !now.has(p.id));
}

/** Visible symbol and screen-reader text, e.g. "↑3" / "up 3 places". */
export function movementLabel(m: Movement): { symbol: string; text: string } {
  const places = (n: number) => `${n} place${n === 1 ? "" : "s"}`;
  switch (m.kind) {
    case "up":
      return { symbol: `↑${m.by}`, text: `up ${places(m.by)}` };
    case "down":
      return { symbol: `↓${m.by}`, text: `down ${places(m.by)}` };
    case "same":
      return { symbol: "=", text: "same position" };
    case "new":
      return { symbol: "new", text: "new in the top 10" };
  }
}
