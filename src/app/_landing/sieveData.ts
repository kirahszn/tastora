// Data for the landing page's safety check (Sieve.tsx), computed when the page is built by the same
// Phase 2 code the app uses: normalizePlaces → rankCandidates (evaluate) → buildExplanationFacts.
// Input: the committed Qloo sample fixtures/qloo/samples/E5h-west-african-signal-fela.json (a real
// /v2/insights response, Phase 1 probe, 2026-10-26: West African restaurants in New York City with
// a Fela Kuti signal) and the app's "Nigerian food in Brooklyn" example profile (peanut allergy,
// soft food). Nothing here is typed by hand; tests/landing.test.ts checks the output.
import { buildExplanationFacts } from "@/lib/agent/explanationFacts";
import { candidateDishes, type RequirementResult } from "@/lib/constraints/evaluate";
import { normalizePlaces } from "@/lib/domain/place";
import { SeniorProfileSchema } from "@/lib/domain/profile";
import { rankCandidates } from "@/lib/ranking/rank";
import { draftToInput, exampleById } from "@/lib/ui/profileDraft";
import sample from "../../../fixtures/qloo/samples/E5h-west-african-signal-fela.json";

/**
 * Places shown, chosen to cover a venue where most dishes are set aside (shown first, with its
 * warning), one dish set aside, and a keyword match.
 */
export const SIEVE_PLACES = ["Brooklyn Suya", "Buka", "Accra Express Restaurant"] as const;

export interface SievePlace {
  name: string;
  area: string | null;
  /** Every dish Qloo lists, as Qloo lists them. */
  listed: string[];
  /** Dishes to ask about, with the engine's note ("possibly soft — confirm"). */
  kept: { name: string; note?: string }[];
  /** Dishes set aside, with the engine's reason. */
  setAside: { name: string; why: string }[];
  statuses: Pick<RequirementResult, "kind" | "requirement" | "status">[];
  warnings: string[];
}

export function sieveSamples(): SievePlace[] {
  const profile = SeniorProfileSchema.parse(draftToInput(exampleById("fela").draft));
  const entities = (sample as unknown as { body: { results: { entities: unknown[] } } }).body.results.entities;
  const { ranked } = rankCandidates(profile, normalizePlaces(entities), {}, {});
  return SIEVE_PLACES.map((name) => {
    const item = ranked.find((r) => r.candidate.name === name);
    if (!item) throw new Error(`${name} is not in the sample`);
    const facts = buildExplanationFacts(profile, item, { tasteSignals: profile.tasteMemories.music });
    return {
      name,
      area: facts.area.label,
      listed: candidateDishes(item.candidate).map((d) => d.name),
      kept: facts.dishesToAskAbout.map((d) => ({ name: d.name, ...(d.note ? { note: d.note } : {}) })),
      setAside: facts.removedDishes.map((d) => ({ name: d.name, why: d.why })),
      statuses: facts.constraintStatuses.map(({ kind, requirement, status }) => ({ kind, requirement, status })),
      warnings: facts.warnings.map((w) => w.text),
    };
  });
}
