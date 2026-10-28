// Rank movement between Qloo's top 10 without and with taste signals (from `evidence` only).
import type { PlaceRef, QlooEvidence } from "./types";

/** "A", "A and B", "A, B and C". */
export const joinList = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/**
 * One plain sentence for the top of the evidence panel, e.g. "Frank Sinatra brought in 6 new
 * places and moved all 10." Null when no signal was used or there is nothing to compare.
 */
export function evidenceSentence(
  e: Pick<QlooEvidence, "signalsUsed" | "personalisedTop10" | "overlapCount" | "rankChanges">,
): string | null {
  const n = e.personalisedTop10.length;
  if (!e.signalsUsed.length || !n) return null;
  const who = joinList(e.signalsUsed.map((s) => s.name));
  const added = n - e.overlapCount;
  const moved = e.rankChanges === n ? `all ${n}` : `${e.rankChanges} of the ${n}`;
  if (!e.rankChanges) return `${who} didn't change Qloo's top ${n}.`;
  if (!added) return `${who} brought in no new places but moved ${moved}.`;
  return `${who} brought in ${added} new place${added === 1 ? "" : "s"} and moved ${moved}.`;
}

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
