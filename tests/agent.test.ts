import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { recommend } from "@/lib/agent/recommend";
import { AGENT_LIMITS, SearchSession } from "@/lib/agent/session";
import { makeProfile } from "./helpers/fixtures";
import { fakeQloo, happyPathScript, IDS, message, scriptedClaude, text, toolUse } from "./helpers/fakes";

// Profile A from the brief, plus every field the model must never see.
const profile = makeProfile({
  displayName: "Mama Ada",
  favouriteCuisines: ["Nigerian"],
  favouriteDishes: ["jollof rice"],
  dislikes: ["okra"],
  allergies: ["peanut"],
  dietaryRestrictions: ["halal"],
  texture: "soft",
  comfort: { quietPreferred: true, wheelchairAccess: true },
  tasteMemories: { music: ["Fela Kuti"] },
  location: "Brooklyn",
});

const toolResults = (body: Anthropic.MessageCreateParamsNonStreaming) => {
  const last = body.messages[body.messages.length - 1];
  return (Array.isArray(last.content) ? last.content : []).filter(
    (b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result",
  );
};

describe("agent planner", () => {
  it("runs the happy path with Claude and returns results, trace and evidence", async () => {
    const { search } = fakeQloo();
    const { client, requests } = scriptedClaude(happyPathScript());
    const res = await recommend(profile, {}, { search, anthropic: client, model: "test-model" });

    expect(res.meta.planner).toBe("agent");
    expect(res.meta.model).toBe("test-model");
    expect(res.meta.anthropicRequests).toBe(3);
    expect(requests).toHaveLength(3);
    expect(res.results.map((r) => r.name)[0]).toBe("Buka");
    expect(res.excluded).toEqual([]);
    expect(res.trace.map((s) => s.tool)).toContain("search_restaurants");
    expect(res.trace.find((s) => s.tool === "find_taste_entities")!.resultSummary).toBe("Found 'Fela Kuti' (artist)");
    expect(res.trace.find((s) => s.tool === "search_restaurants")!.inputSummary).toBe(
      "Nigerian restaurants in Brooklyn with 1 taste signal (Fela Kuti)",
    );
    expect(res.trace.find((s) => s.tool === "search_restaurants")!.resultSummary).toBe("5 places, 1 non-restaurant dropped");
    expect(res.trace.map((s) => s.step)).toEqual(res.trace.map((_, i) => i + 1));

    // Evidence: the fake returns the same places in reverse order without signals.
    expect(res.evidence!.signalsUsed).toEqual([{ id: IDS.fela, name: "Fela Kuti", kind: "artist" }]);
    expect(res.evidence!.personalisedTop10.map((p) => p.name)).toEqual([
      "Buka",
      "Joloff",
      "Accra Express Restaurant",
      "Cafe Rue Dix",
      "Brooklyn Suya",
    ]);
    expect(res.evidence!.baselineTop10.map((p) => p.name)[0]).toBe("Brooklyn Suya");
    expect(res.evidence!.overlapCount).toBe(5);
    expect(res.evidence!.rankChanges).toBe(4); // reversed list of 5: only the middle one stays
    expect(res.meta.qlooCalls).toBe(4); // tags, search, insights with signal, baseline insights
  });

  it("never sends allergies, restrictions, texture, comfort or display name to the model", async () => {
    const { search } = fakeQloo();
    const { client, requests } = scriptedClaude(happyPathScript());
    await recommend(profile, {}, { search, anthropic: client });
    // Everything the model reads about the person is in `messages` (the system prompt is static).
    const sent = JSON.stringify(requests.map((r) => r.messages));
    for (const secret of [
      "peanut",
      "halal",
      "Mama Ada",
      "allergies",
      "dietaryRestrictions",
      "texture",
      "comfort",
      "wheelchair",
      "quietPreferred",
      "displayName",
      "location",
    ]) {
      expect(sent).not.toContain(secret);
    }
    expect(requests.every((r) => !JSON.stringify(r.system).includes("peanut"))).toBe(true);
    // What it does get:
    expect(sent).toContain("Nigerian");
    expect(sent).toContain("jollof rice");
    expect(sent).toContain("okra");
    expect(sent).toContain("Fela Kuti");
  });

  it("rejects invented ids with an error returned to the model", async () => {
    const { search, calls } = fakeQloo();
    const { client, requests } = scriptedClaude([
      message([toolUse("t1", "search_restaurants", { cuisine_tag_ids: ["urn:tag:cuisine:qloo:made_up"] })]),
      ...happyPathScript(),
    ]);
    const res = await recommend(profile, {}, { search, anthropic: client });
    const [rejected] = toolResults(requests[1]);
    expect(rejected.is_error).toBe(true);
    expect(rejected.content).toMatch(/Unknown id\(s\): urn:tag:cuisine:qloo:made_up/);
    // No Qloo call was made for the invented id.
    expect(calls.some((c) => c.params["filter.tags"] === "urn:tag:cuisine:qloo:made_up")).toBe(false);
    expect(res.meta.planner).toBe("agent");
  });

  it("rejects an entity id that came from a different lookup type", async () => {
    const { search } = fakeQloo();
    const { client, requests } = scriptedClaude([
      message([toolUse("t1", "find_cuisine_tags", { query: "Nigerian" })]),
      message([
        toolUse("t2", "search_restaurants", { cuisine_tag_ids: [IDS.nigerianCuisine], signal_entity_ids: [IDS.fela] }),
      ]),
    ]);
    await recommend(profile, {}, { search, anthropic: client });
    expect(toolResults(requests[2])[0].is_error).toBe(true);
  });

  it("enforces the tool-call cap", async () => {
    const { search, calls } = fakeQloo();
    const many = Array.from({ length: 12 }, (_, i) => toolUse(`t${i}`, "find_cuisine_tags", { query: `cuisine ${i}` }));
    const { client, requests } = scriptedClaude([
      message(many),
      ...happyPathScript(), // never reached: the loop stops at the cap
    ]);
    const res = await recommend(profile, {}, { search, anthropic: client });
    expect(requests).toHaveLength(1);
    // 10 lookups ran, 2 were rejected; then the fallback planner had to run (no search).
    expect(calls.filter((c) => c.path === "/v2/tags" && String(c.params["filter.query"]).startsWith("cuisine"))).toHaveLength(
      AGENT_LIMITS.maxToolCalls,
    );
    expect(res.trace.filter((s) => s.resultSummary.startsWith("Rejected: Tool-call limit"))).toHaveLength(2);
    expect(res.meta.planner).toBe("fallback");
  });

  it("caps model turns", async () => {
    const { search } = fakeQloo();
    const loop = () => message([toolUse(`t${Math.random()}`, "find_cuisine_tags", { query: "Nigerian" })]);
    const { client, requests } = scriptedClaude(Array.from({ length: 20 }, () => loop));
    await recommend(profile, {}, { search, anthropic: client });
    expect(requests.length).toBeLessThanOrEqual(AGENT_LIMITS.maxModelTurns);
  });

  it("caps restaurant searches at 3", async () => {
    const { search } = fakeQloo();
    const s = (id: string) => toolUse(id, "search_restaurants", { cuisine_tag_ids: [IDS.nigerianCuisine] });
    const { client, requests } = scriptedClaude([
      message([toolUse("t1", "find_cuisine_tags", { query: "Nigerian" })]),
      message([s("a"), s("b"), s("c"), s("d")]),
    ]);
    const res = await recommend(profile, {}, { search, anthropic: client });
    const results = toolResults(requests[2]);
    expect(results.map((r) => !!r.is_error)).toEqual([false, false, false, true]);
    expect(res.trace.filter((st) => st.tool === "search_restaurants" && !st.resultSummary.startsWith("Rejected"))).toHaveLength(3);
  });

  it("injects the profile location; the agent cannot override it", async () => {
    const { search, calls } = fakeQloo();
    const { client, requests } = scriptedClaude(happyPathScript({ location: "Paris, France" }));
    await recommend(profile, {}, { search, anthropic: client });
    const insights = calls.filter((c) => c.path === "/v2/insights");
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.every((c) => c.params["filter.location.query"] === "Brooklyn")).toBe(true);
    // The tool schema has no location field at all.
    const searchTool = requests[0].tools!.find((t) => "name" in t && t.name === "search_restaurants") as Anthropic.Tool;
    expect(Object.keys(searchTool.input_schema.properties ?? {})).not.toContain("location");
  });

  it("uses the fallback planner when Anthropic throws", async () => {
    const { search } = fakeQloo();
    const client = {
      messages: {
        create: async () => {
          throw new Anthropic.InternalServerError(500, { type: "error" }, "boom", new Headers());
        },
      },
    };
    const res = await recommend(profile, {}, { search, anthropic: client });
    expect(res.meta.planner).toBe("fallback");
    expect(res.meta.model).toBeNull();
    expect(res.meta.fallbackReason).toBe("Claude API error 500");
    expect(res.results[0].name).toBe("Buka");
    expect(res.evidence!.signalsUsed.map((s) => s.name)).toEqual(["Fela Kuti"]);
    expect(res.trace[0].resultSummary).toBe("Not available right now (Claude API error 500)");
  });

  it("uses the fallback planner when no key is configured", async () => {
    const { search } = fakeQloo();
    const res = await recommend(profile, {}, { search, anthropic: null });
    expect(res.meta.planner).toBe("fallback");
    expect(res.meta.fallbackReason).toBe("no Anthropic API key configured");
    expect(res.meta.anthropicRequests).toBe(0);
  });

  it("falls back when the time budget runs out before Claude can plan", async () => {
    const { search } = fakeQloo();
    const { client, requests } = scriptedClaude(happyPathScript());
    const res = await recommend(profile, {}, { search, anthropic: client, agentBudgetMs: 0 });
    expect(requests).toHaveLength(0);
    expect(res.meta.planner).toBe("fallback");
  });

  it("keeps the agent's results when Claude ends without a final message", async () => {
    const { search } = fakeQloo();
    const script = happyPathScript().slice(0, 2);
    const { client } = scriptedClaude([...script, message([text("")], "max_tokens")]);
    const res = await recommend(profile, {}, { search, anthropic: client });
    expect(res.meta.planner).toBe("agent");
  });

  it("dedupes places across searches, keeping the best Qloo rank", async () => {
    const { search } = fakeQloo();
    const second = toolUse("t9", "search_restaurants", { cuisine_tag_ids: [IDS.nigerianGenre] });
    const script = happyPathScript();
    script.splice(2, 0, message([second]));
    const { client } = scriptedClaude(script);
    const res = await recommend(profile, {}, { search, anthropic: client });
    // Second search (no signal) returns the same 5 places reversed; each appears once.
    const names = res.results.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(5);
    // Buka was #1 in the signalled search and #5 in the other: rank 1 wins, with its signals.
    const buka = res.results.find((r) => r.name === "Buka")!;
    expect(buka.reasons[0].text).toBe("One of Qloo's top 5 matches for people who love Fela Kuti");
    expect(buka.reasons[0].source).toContain("with signals: Fela Kuti");
  });

  it("keeps allergy data out of the trace", async () => {
    const { search } = fakeQloo();
    const { client } = scriptedClaude(happyPathScript());
    const res = await recommend(profile, {}, { search, anthropic: client });
    expect(JSON.stringify(res.trace).toLowerCase()).not.toMatch(/peanut|halal|allerg|mama ada/);
  });

  it("statuses come from Phase 2, not the model", async () => {
    const { search } = fakeQloo();
    const { client } = scriptedClaude(happyPathScript({ status: "matched", safe: true }));
    const res = await recommend(profile, {}, { search, anthropic: client });
    for (const r of res.results) {
      expect(r.constraintStatuses.find((s) => s.kind === "allergy")!.status).toBe("needs_confirmation");
    }
  });
});

describe("SearchSession", () => {
  it("rejects malformed tool input without calling Qloo", async () => {
    const { search, calls } = fakeQloo();
    const session = new SearchSession(search, "Brooklyn");
    const out = await session.run("find_taste_entities", { query: "Fela", kind: "podcast" });
    expect(out.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("reports a Qloo failure to the model without upstream details", async () => {
    const { search } = fakeQloo({ fail: true });
    const session = new SearchSession(search, "Brooklyn");
    const out = await session.run("find_cuisine_tags", { query: "Nigerian" });
    expect(out).toEqual({ content: "Qloo request failed (error). You may retry once or continue without it.", isError: true });
  });
});
