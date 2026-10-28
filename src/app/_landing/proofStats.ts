// The landing page's "Why Qloo" numbers. Every one is copied from a logged test search; nothing is
// rounded or invented. `source` quotes the doc line it comes from, and tests/landing.test.ts checks
// that each quote is still in that doc. Each search was run with and without the person's taste
// signals (the "baseline"); the numbers compare the two top-10 lists.
export const QLOO_PROOF = [
  {
    // docs/phase3-smoke.md:98, profile B (Italian-American, Queens, Frank Sinatra):
    // 4 of the personalised top 10 were also in the baseline top 10, so 6 were new.
    figure: "6 of 10",
    text: "of the top 10 were new places",
    who: "A Frank Sinatra fan who loves Italian-American food, Queens",
    source: { doc: "docs/phase3-smoke.md", quote: "**Top-10 overlap: 4/10**" },
  },
  {
    // docs/phase5-profile-matrix.md:14, row 1† (Caribbean, Bob Marley, Bronx): evidence "0 / 10".
    figure: "0 of 10",
    text: "places in common with a plain search",
    who: "A Bob Marley fan who loves Caribbean food, the Bronx",
    source: { doc: "docs/phase5-profile-matrix.md", quote: "Bob Marley replaced the whole Caribbean top 10 (0/10 shared)" },
  },
  {
    // docs/phase5-profile-matrix.md:22, row 9 (Nigerian, Fela Kuti, Brooklyn): evidence "10 / 7".
    figure: "7 of 10",
    text: "places moved to a new position",
    who: "A Fela Kuti fan who loves Nigerian food, Brooklyn",
    source: { doc: "docs/phase5-profile-matrix.md", quote: "(10/10 shared, 7 moved)" },
  },
] as const;
