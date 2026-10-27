// Phase 5 live profile matrix: runs realistic profiles through the full pipeline (Claude planner →
// Qloo → Phase 2 ranking) and writes a JSON summary per run for docs/phase5-profile-matrix.md.
// Usage: `npm run matrix -- 1 2 3` (profile numbers; none = all). Budgets are enforced by wrappers
// that throw once exceeded. Never prints keys; stores no raw Qloo responses.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { AnthropicLike } from "../src/lib/agent/claudePlanner";
import { recommend } from "../src/lib/agent/recommend";
import { containsKeyword } from "../src/lib/constraints/keywords";
import { SeniorProfileSchema, type SeniorProfileInput } from "../src/lib/domain/profile";
import { getAnthropicEnv } from "../src/lib/env";
import { TtlCache } from "../src/lib/qloo/cache";
import { qlooGet } from "../src/lib/qloo/client";
import { createQlooSearch } from "../src/lib/qloo/search";

process.loadEnvFile(".env.local");

const QLOO_BUDGET = Number(process.env.MATRIX_QLOO_BUDGET ?? 90);
const ANTHROPIC_BUDGET = Number(process.env.MATRIX_ANTHROPIC_BUDGET ?? 70);
const OUT_DIR = process.env.MATRIX_OUT ?? "matrix-out";

const PROFILES: Record<number, { label: string; input: SeniorProfileInput }> = {
  1: {
    label: "Caribbean, Bob Marley, shellfish allergy, Bronx",
    input: { favouriteCuisines: ["Caribbean"], favouriteDishes: ["oxtail"], allergies: ["shellfish"], tasteMemories: { music: ["Bob Marley"] }, location: "Bronx" },
  },
  2: {
    label: "Cantonese, Teresa Teng, easy to chew, Chinatown",
    input: {
      favouriteCuisines: ["Cantonese", "Chinese"],
      favouriteDishes: ["dim sum", "congee"],
      texture: "easy_to_chew",
      tasteMemories: { music: ["Teresa Teng"] },
      location: "Chinatown, Manhattan",
    },
  },
  3: {
    label: "Jewish deli, Barbra Streisand, kosher, Manhattan",
    input: { favouriteCuisines: ["Jewish deli"], favouriteDishes: ["matzo ball soup"], dietaryRestrictions: ["kosher"], tasteMemories: { music: ["Barbra Streisand"] }, location: "Manhattan" },
  },
  4: {
    label: "Indian vegetarian, Lata Mangeshkar, dairy allergy, Jackson Heights",
    input: {
      favouriteCuisines: ["Indian"],
      favouriteDishes: ["dal"],
      dietaryRestrictions: ["vegetarian"],
      allergies: ["dairy"],
      tasteMemories: { music: ["Lata Mangeshkar"] },
      location: "Jackson Heights, Queens",
    },
  },
  5: {
    label: "Mexican, Vicente Fernández, no restrictions, Bronx",
    input: { favouriteCuisines: ["Mexican"], favouriteDishes: ["pozole"], tasteMemories: { music: ["Vicente Fernández"] }, location: "Bronx" },
  },
  6: {
    label: "Korean, sesame allergy, soft texture, Brooklyn",
    input: { favouriteCuisines: ["Korean"], favouriteDishes: ["soft tofu stew"], allergies: ["sesame"], texture: "soft", location: "Brooklyn" },
  },
  7: {
    label: "Greek, wheelchair + quiet, Astoria",
    input: {
      favouriteCuisines: ["Greek"],
      favouriteDishes: ["moussaka"],
      comfort: { wheelchairAccess: true, quietPreferred: true },
      location: "Astoria, Queens",
    },
  },
  8: {
    label: "Polish, sparse (no taste memories), Greenpoint",
    input: { favouriteCuisines: ["Polish"], favouriteDishes: ["pierogi"], location: "Greenpoint, Brooklyn" },
  },
  9: {
    label: "Misspelt: 'Nigeran', 'Fela Kutti', Brooklyn",
    input: { favouriteCuisines: ["Nigeran"], tasteMemories: { music: ["Fela Kutti"] }, location: "Brooklyn" },
  },
  10: {
    label: "Haitian + unknown local band, Brooklyn",
    input: { favouriteCuisines: ["Haitian"], tasteMemories: { music: ["The Flatbush Porch Rockers"] }, location: "Brooklyn" },
  },
};

/** Broader than the engine on purpose: words a reviewer should look at, not removal rules. */
const WATCH: Record<string, string[]> = {
  shellfish: ["shrimp", "prawn", "crab", "lobster", "conch", "crayfish", "crawfish", "clam", "mussel", "oyster", "scallop", "squid", "calamari", "octopus", "seafood", "escovitch", "run down", "paella", "gumbo", "ceviche", "scampi"],
  dairy: ["milk", "cheese", "butter", "cream", "paneer", "ghee", "raita", "lassi", "yogurt", "curd", "kheer", "malai", "kulfi", "makhani", "korma", "rasmalai", "rasgulla", "gulab jamun", "mozzarella", "parmesan", "feta", "tzatziki", "queso", "kofta", "saag", "palak"],
  sesame: ["sesame", "tahini", "hummus", "bibimbap", "japchae", "kimbap", "gimbap", "namul", "bulgogi", "halva"],
};

let qlooCalls = 0;
let anthropicCalls = 0;
const cache = new TtlCache();
const budgetedGet = (path: string, params: Parameters<typeof qlooGet>[1]) => {
  if (++qlooCalls > QLOO_BUDGET) throw new Error(`Qloo budget of ${QLOO_BUDGET} exceeded`);
  return qlooGet(path, params);
};
const env = getAnthropicEnv();
const realClient = env.apiKey ? new Anthropic({ apiKey: env.apiKey }) : null;
const budgetedClient: AnthropicLike | null = realClient && {
  messages: {
    create: (body, options) => {
      if (++anthropicCalls > ANTHROPIC_BUDGET) throw new Error(`Anthropic budget of ${ANTHROPIC_BUDGET} exceeded`);
      return realClient.messages.create(body, options);
    },
  },
};

async function runOne(n: number) {
  const p = PROFILES[n];
  const profile = SeniorProfileSchema.parse(p.input);
  const search = createQlooSearch({ get: budgetedGet, cache });
  const res = await recommend(profile, {}, { search, anthropic: budgetedClient });
  const watch = profile.allergies.flatMap((a) => WATCH[a] ?? []);
  const possibleMisses = res.results.flatMap((r) =>
    r.dishesToAskAbout.filter((d) => watch.some((w) => containsKeyword(d.name, w))).map((d) => `${r.name}: ${d.name}`),
  );
  return {
    n,
    label: p.label,
    meta: res.meta,
    trace: res.trace.map((s) => `${s.tool} | ${s.inputSummary} → ${s.resultSummary}`),
    resultCount: res.results.length,
    excluded: res.excluded.map((e) => `${e.name}: ${e.reasons.join("; ")}`),
    results: res.results.map((r) => ({
      rank: r.rank,
      name: r.name,
      area: r.area.label,
      neighborhood: r.venue.neighborhood,
      cuisines: r.venue.cuisines,
      total: r.scoreBreakdown.total,
      reasons: r.reasons.map((x) => x.text),
      statuses: r.constraintStatuses.map((s) => `${s.requirement}: ${s.status}`),
      warnings: r.warnings.map((w) => w.text),
      removed: r.removedDishes.map((d) => `${d.name} (${d.why})`),
      dishes: r.dishesToAskAbout.map((d) => d.name + (d.note ? " [soft?]" : "")),
    })),
    evidence: res.evidence && {
      tags: res.evidence.cuisineTagNames,
      signals: res.evidence.signalsUsed.map((s) => `${s.name} (${s.kind})`),
      overlap: `${res.evidence.overlapCount}/${res.evidence.personalisedTop10.length}`,
      moved: res.evidence.rankChanges,
    },
    possibleMisses,
    notices: res.notices,
  };
}

async function main() {
  const picks = process.argv.slice(2).map(Number).filter((n) => PROFILES[n]);
  const which = picks.length ? picks : Object.keys(PROFILES).map(Number);
  mkdirSync(OUT_DIR, { recursive: true });
  for (const n of which) {
    try {
      const out = await runOne(n);
      writeFileSync(join(OUT_DIR, `profile-${n}.json`), JSON.stringify(out, null, 2));
      console.log(
        `#${n} ${out.label}: ${out.meta.planner} ${(out.meta.durationMs / 1000).toFixed(1)}s results=${out.resultCount} ` +
          `top3=${out.results.slice(0, 3).map((r) => r.name).join(" / ")} misses=${out.possibleMisses.length}`,
      );
    } catch (err) {
      console.log(`#${n} FAILED: ${err instanceof Error ? `${err.name}: ${err.message}` : "error"}`);
    }
  }
  console.log(`Totals: qloo=${qlooCalls}/${QLOO_BUDGET} anthropic=${anthropicCalls}/${ANTHROPIC_BUDGET}`);
}

main();
