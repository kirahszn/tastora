// Phase 3 live smoke test: full pipeline (Claude planner → Qloo → Phase 2 ranking) for two
// profiles. Run with `npm run smoke:recommend`. Hard budget: ≤40 Qloo calls and ≤10 Anthropic
// requests in total, enforced by wrappers that throw once exceeded. Writes a short summary to
// docs/phase3-smoke.md (no raw Qloo responses). Never prints keys.
import { writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import type { AnthropicLike } from "../src/lib/agent/claudePlanner";
import { recommend, type RecommendResponse } from "../src/lib/agent/recommend";
import { SeniorProfileSchema, type SeniorProfileInput } from "../src/lib/domain/profile";
import { getAnthropicEnv } from "../src/lib/env";
import { TtlCache } from "../src/lib/qloo/cache";
import { qlooGet } from "../src/lib/qloo/client";
import { createQlooSearch } from "../src/lib/qloo/search";

process.loadEnvFile(".env.local");

const QLOO_BUDGET = 40;
const ANTHROPIC_BUDGET = 10;
const OUT = "docs/phase3-smoke.md";

const PROFILES: { label: string; input: SeniorProfileInput }[] = [
  {
    label: "A — Nigerian, Brooklyn",
    input: {
      favouriteCuisines: ["Nigerian"],
      favouriteDishes: ["jollof rice"],
      allergies: ["peanut"],
      texture: "soft",
      tasteMemories: { music: ["Fela Kuti"] },
      location: "Brooklyn",
    },
  },
  {
    label: "B — Italian-American, Queens",
    input: {
      favouriteCuisines: ["Italian-American"],
      favouriteDishes: ["chicken parm"],
      dietaryRestrictions: ["no pork"],
      comfort: { wheelchairAccess: true },
      tasteMemories: { music: ["Frank Sinatra"] },
      location: "Queens",
    },
  },
];

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

const esc = (s: string) => s.replace(/\|/g, "\\|");

function summarise(label: string, res: RecommendResponse): string {
  const m = res.meta;
  const lines = [
    `## Profile ${label}`,
    "",
    `- Planner: **${m.planner}**${m.model ? ` (${m.model})` : ""}${m.fallbackReason ? `; fallback reason: ${m.fallbackReason}` : ""}`,
    `- Latency: **${(m.durationMs / 1000).toFixed(1)} s**; Qloo calls: ${m.qlooCalls} (+${m.qlooCacheHits} cache hits); Anthropic requests: ${m.anthropicRequests}`,
    `- Results: ${res.results.length} shown, ${res.excluded.length} excluded`,
    "",
    "### Top 5",
    "",
    "| # | Restaurant | Area | Score | Reasons | Cautions |",
    "|---|---|---|---|---|---|",
    ...res.results.slice(0, 5).map((r) => {
      const reasons = r.reasons.map((x) => x.text).join("; ");
      const cautions = [
        ...r.warnings.map((w) => w.text),
        ...r.removedDishes.slice(0, 3).map((d) => `${d.name} set aside (${d.why})`),
        ...r.constraintStatuses.filter((s) => s.status !== "needs_confirmation").map((s) => `${s.requirement}: ${s.status}`),
      ].join("; ");
      return `| ${r.rank} | ${esc(r.name)} | ${esc(r.venue.neighborhood ?? r.venue.address ?? "—")} | ${r.scoreBreakdown.total} | ${esc(reasons)} | ${esc(cautions || "—")} |`;
    }),
    "",
    "### Trace",
    "",
    "| Step | Tool | Input | Result | ms |",
    "|---|---|---|---|---|",
    ...res.trace.map((s) => `| ${s.step} | ${s.tool} | ${esc(s.inputSummary)} | ${esc(s.resultSummary)} | ${s.ms} |`),
    "",
    "### With vs without taste signals",
    "",
  ];
  if (!res.evidence) {
    lines.push("No evidence (baseline search did not run or failed).", "");
  } else {
    const e = res.evidence;
    lines.push(
      `- Cuisine tag(s): ${e.cuisineTags.map((t) => `\`${t}\``).join(", ")}`,
      `- Signals: ${e.signalsUsed.map((s) => `${s.name} (${s.kind})`).join(", ") || "none"}`,
      `- **Top-10 overlap: ${e.overlapCount}/${e.personalisedTop10.length}**; ${e.rankChanges} of the personalised top 10 in a different position`,
      "",
      "| # | Personalised | Baseline |",
      "|---|---|---|",
      ...Array.from({ length: Math.max(e.personalisedTop10.length, e.baselineTop10.length) }, (_, i) =>
        `| ${i + 1} | ${esc(e.personalisedTop10[i]?.name ?? "")} | ${esc(e.baselineTop10[i]?.name ?? "")} |`,
      ),
      "",
    );
  }
  return lines.join("\n");
}

async function main() {
  const sections: string[] = [];
  for (const p of PROFILES) {
    const search = createQlooSearch({ get: budgetedGet, cache });
    const profile = SeniorProfileSchema.parse(p.input);
    console.log(`== ${p.label}`);
    const res = await recommend(profile, {}, { search, anthropic: budgetedClient });
    console.log(
      `planner=${res.meta.planner} results=${res.results.length} ${res.meta.durationMs}ms qloo=${res.meta.qlooCalls} anthropic=${res.meta.anthropicRequests}`,
    );
    for (const r of res.results.slice(0, 5)) console.log(`  ${r.rank}. ${r.name} (${r.scoreBreakdown.total})`);
    sections.push(summarise(p.label, res));
  }

  const doc = [
    "# Phase 3 smoke test",
    "",
    `Live run of \`npm run smoke:recommend\` on ${new Date().toISOString().slice(0, 10)}: Claude planner → Qloo search → Phase 2`,
    "evaluate/rank/facts. Summary only; no raw Qloo responses are stored.",
    "",
    `**Totals:** ${qlooCalls} Qloo calls (budget ${QLOO_BUDGET}), ${anthropicCalls} Anthropic requests (budget ${ANTHROPIC_BUDGET}).`,
    "",
    ...sections,
  ].join("\n");
  writeFileSync(OUT, doc);
  console.log(`Totals: qloo=${qlooCalls}/${QLOO_BUDGET} anthropic=${anthropicCalls}/${ANTHROPIC_BUDGET} → ${OUT}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : "smoke test failed");
  process.exit(1);
});
