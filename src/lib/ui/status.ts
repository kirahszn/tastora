// How constraint statuses are shown. Colour is never used alone: every status has an icon and a
// text label too.
import { midSentence } from "@/lib/agent/explanationFacts";
import type { RequirementResult, RequirementStatus } from "./types";

export type StatusTone = "ok" | "warn" | "bad";
export type StatusIcon = "check" | "question" | "cross";

export interface StatusDisplay {
  label: string;
  icon: StatusIcon;
  tone: StatusTone;
}

export const STATUS_DISPLAY: Record<RequirementStatus, StatusDisplay> = {
  matched: { label: "Matched", icon: "check", tone: "ok" },
  needs_confirmation: { label: "Needs confirmation", icon: "question", tone: "warn" },
  conflict: { label: "Conflict", icon: "cross", tone: "bad" },
};

/**
 * Display status for a requirement. Allergies and texture can never be shown as safe: Qloo has
 * no ingredient or texture data. The engine never matches them; this guards the UI regardless.
 */
export function displayStatus(r: Pick<RequirementResult, "kind" | "status">): StatusDisplay {
  if ((r.kind === "allergy" || r.kind === "texture") && r.status === "matched") {
    return STATUS_DISPLAY.needs_confirmation;
  }
  return STATUS_DISPLAY[r.status] ?? STATUS_DISPLAY.needs_confirmation;
}

/** "allergy: peanut" → "Allergy: peanut". */
export function requirementLabel(requirement: string): string {
  return requirement.charAt(0).toUpperCase() + requirement.slice(1);
}

type Need = Pick<RequirementResult, "kind" | "status" | "requirement">;

/** "A", "A and B", "A, B and C". */
const andList = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const needValue = (r: Need) => midSentence(r.requirement.slice(r.requirement.indexOf(":") + 2));

/**
 * The card's compact needs summary (Phase 11): one line per Matched and per Conflict need, and
 * every need still to confirm in one line ("shellfish, sesame and soy allergies · dairy-free ·
 * easy to chew · quiet place"). Grouped by displayStatus, so an allergy or texture need can only
 * ever land in "To confirm". The full per-need list stays under "Show details".
 */
export function compactNeeds<T extends Need>(statuses: readonly T[]): { matched: T[]; conflicts: T[]; toConfirm: string | null } {
  const tone = (r: Need) => displayStatus(r).tone;
  const pending = statuses.filter((r) => tone(r) === "warn");
  const allergies = pending.filter((r) => r.kind === "allergy").map(needValue);
  const parts = [
    ...(allergies.length ? [`${andList(allergies)} ${allergies.length === 1 ? "allergy" : "allergies"}`] : []),
    ...pending.filter((r) => r.kind !== "allergy").map(needValue),
  ];
  return {
    matched: statuses.filter((r) => tone(r) === "ok"),
    conflicts: statuses.filter((r) => tone(r) === "bad"),
    toConfirm: parts.length ? parts.join(" · ") : null,
  };
}

/**
 * Split a sourced string ("profile.allergies: \"peanut\"", "qloo.dishHighlights: …",
 * "feedback.notSuitable: …") into its source and text. Strings without a source prefix are all text.
 */
export function splitSource(s: string): { source: string | null; text: string } {
  const m = /^((?:profile|qloo|feedback)\.[\w.]+):\s*([\s\S]*)$/.exec(s);
  return m ? { source: m[1], text: m[2] } : { source: null, text: s };
}
