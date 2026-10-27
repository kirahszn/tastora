// How constraint statuses are shown. Colour is never used alone: every status has an icon and a
// text label too.
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

/**
 * Split a sourced string ("profile.allergies: \"peanut\"", "qloo.dishHighlights: …",
 * "feedback.notSuitable: …") into its source and text. Strings without a source prefix are all text.
 */
export function splitSource(s: string): { source: string | null; text: string } {
  const m = /^((?:profile|qloo|feedback)\.[\w.]+):\s*([\s\S]*)$/.exec(s);
  return m ? { source: m[1], text: m[2] } : { source: null, text: s };
}
