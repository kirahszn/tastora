// Which original cuisine illustration (CuisineArt.tsx) a card shows when Qloo has no image for the
// place. Chosen only from the venue's own cuisine tags, first match wins; decorative, never a claim
// about the restaurant's dishes.

export type CuisineArtKind =
  | "italian"
  | "westAfrican"
  | "caribbean"
  | "chinese"
  | "indian"
  | "mexican"
  | "japanese"
  | "korean"
  | "middleEastern"
  | "plate";

const KEYWORDS: readonly [CuisineArtKind, RegExp][] = [
  ["italian", /\b(italian|pizza|pizzeria|pasta|trattoria|sicilian|neapolitan)\b/i],
  ["westAfrican", /\b(nigerian|west african|ghanaian|senegalese|african)\b/i],
  ["caribbean", /\b(caribbean|jamaican|trinidadian|haitian|guyanese)\b/i],
  ["chinese", /\b(chinese|cantonese|szechuan|sichuan|dim sum|hunan|taiwanese)\b/i],
  ["indian", /\b(indian|south asian|pakistani|bangladeshi|sri lankan|nepalese)\b/i],
  ["mexican", /\b(mexican|tex[\s-]mex|taqueria|tacos?)\b/i],
  ["japanese", /\b(japanese|sushi|ramen|izakaya)\b/i],
  ["korean", /\bkorean\b/i],
  ["middleEastern", /\b(middle eastern|lebanese|turkish|israeli|persian|syrian|falafel|egyptian)\b/i],
];

export function cuisineArtFor(cuisines: readonly string[]): CuisineArtKind {
  for (const c of cuisines) {
    const hit = KEYWORDS.find(([, re]) => re.test(c));
    if (hit) return hit[0];
  }
  return "plate";
}

/** Qloo's place image, only when it is an https URL on Qloo's own image host. */
export function qlooImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "images.qloo.com" ? u.toString() : null;
  } catch {
    return null;
  }
}
