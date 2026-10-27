// Static snapshot of one real result for the landing page's sample card. Nothing here is invented.
// Captured 2026-10-27 from one live POST to https://tastora-three.vercel.app/api/recommend with the
// "Italian-American in Queens" example (chicken parm, Frank Sinatra, no pork, wheelchair access,
// Queens). Planner: agent (claude-sonnet-5-5), 4 Qloo calls. This is result #1; the strings below are
// copied verbatim from `results[0]` (name, venue.neighborhood + area.label, reasons[0..1],
// constraintStatuses, needsConfirmation[0]). Qloo's data changes, so a new search may differ.
import type { RequirementResult } from "@/lib/ui/types";

export const SAMPLE_CAPTURED = "2026-10-27";

export const SAMPLE_RESULT: {
  name: string;
  place: string;
  reasons: string[];
  statuses: Pick<RequirementResult, "kind" | "status" | "requirement">[];
  question: string;
} = {
  name: "Lenny's Clam Bar",
  place: "Howard Beach · In Queens",
  reasons: ["Qloo ranked it #3 for this person's tastes", "Italian — related to Italian-American"],
  statuses: [
    { kind: "comfort", requirement: "comfort: wheelchair access", status: "matched" },
    { kind: "diet", requirement: "diet: no pork", status: "needs_confirmation" },
  ],
  question: "Ask which dishes are made without pork",
};
