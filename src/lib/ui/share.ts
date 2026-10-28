// Plain-text shortlist for sharing (WhatsApp, the share sheet, the clipboard). It only lays out
// facts from `results[]`; it never adds restaurant text, scores or set-aside dishes, and the
// display name only ever appears in this text, built on the device.
import { placeLine } from "./format";
import { formatPhone, safeHttpUrl, telHref } from "./links";
import { requirementLabel } from "./status";
import type { RecommendResult } from "./types";

export const SITE_URL = "https://tastora-three.vercel.app";
export const SHARE_DISCLAIMER = "Tastora can't confirm ingredients or allergens. Please check with the restaurant.";
/** Target length for the whole message; three places fit at full detail in most cases. */
export const SHARE_TEXT_LIMIT = 1500;

const MAX_DISHES = 3;
const MAX_QUESTIONS = 3;

export function shareHeading(profileName?: string | null): string {
  const name = profileName?.trim();
  return name ? `Restaurant ideas for ${name} from Tastora` : "Restaurant ideas from Tastora";
}

type Reason = RecommendResult["reasons"][number];

/** Reason 0 is Qloo's taste reason; it names the signals ("…for people who love Frank Sinatra") when there were any. */
const namesSignal = (x: Reason | undefined) =>
  !!x && x.source.startsWith("profile.tasteMemories") && /\bwho love\b/.test(x.text);

// Most telling to a family member first, by what the reason was matched from.
const reasonWeight = (x: Reason) =>
  x.source.startsWith("profile.favouriteDishes")
    ? 0
    : x.source.startsWith("profile.favouriteCuisines")
      ? x.strength === "related"
        ? 2
        : 1
      : x.source.startsWith("feedback.liked")
        ? 3
        : 4;

/**
 * The reason to show a family member: Qloo's taste reason when it names a signal, then a
 * favourite dish, then cuisine. The generic taste reason is only used when there is nothing else.
 */
export function topReason(r: Pick<RecommendResult, "reasons">): string | null {
  if (namesSignal(r.reasons[0])) return r.reasons[0].text;
  const rest = r.reasons.slice(1).map((x, i) => ({ x, i }));
  rest.sort((a, b) => reasonWeight(a.x) - reasonWeight(b.x) || a.i - b.i);
  return (rest[0]?.x ?? r.reasons[0])?.text ?? null;
}

/**
 * Comfort and diet needs a Qloo venue tag supports, e.g. "Wheelchair access (venue tag)".
 * Allergies and texture are never listed: Qloo has no data that could support them.
 */
export function goodSigns(r: Pick<RecommendResult, "constraintStatuses">): string[] {
  return r.constraintStatuses
    .filter((s) => s.status === "matched" && (s.kind === "comfort" || s.kind === "diet"))
    .map((s) => {
      const label = requirementLabel(s.requirement.slice(s.requirement.indexOf(":") + 2));
      return s.kind === "diet" ? `${label} (venue tag; confirm)` : `${label} (venue tag)`;
    });
}

/** Shortlisted results, in shortlist sequence; unknown ids are skipped. */
export function shortlistedResults(results: readonly RecommendResult[], shortlistIds: readonly string[]): RecommendResult[] {
  const byId = new Map(results.map((r) => [r.candidateId, r]));
  return [...new Set(shortlistIds)].map((id) => byId.get(id)).filter((r): r is RecommendResult => !!r);
}

interface Detail {
  dishes: number;
  questions: number;
  reason: boolean;
}

// Tried from the top until the message fits. Questions to ask go last: they matter most.
const DETAIL_LEVELS: Detail[] = [
  { dishes: MAX_DISHES, questions: MAX_QUESTIONS, reason: true },
  { dishes: 2, questions: MAX_QUESTIONS, reason: true },
  { dishes: 1, questions: MAX_QUESTIONS, reason: true },
  { dishes: 1, questions: MAX_QUESTIONS, reason: false },
  { dishes: 0, questions: 2, reason: false },
  { dishes: 0, questions: 1, reason: false },
];

function placeBlock(r: RecommendResult, n: number, d: Detail): string {
  const where = placeLine(r);
  const lines = [`${n}. ${r.name}${where ? ` — ${where}` : ""}`];
  const reason = d.reason ? topReason(r) : null;
  if (reason) lines.push(`Why: ${reason}`);
  const signs = d.reason ? goodSigns(r) : [];
  if (signs.length) lines.push(`Good signs: ${signs.join(", ")}`);
  for (const w of r.warnings) lines.push(`Note: ${w.text}`);
  for (const c of r.constraintStatuses.filter((s) => s.status === "conflict")) {
    lines.push(`Conflict: ${requirementLabel(c.requirement)}`);
  }
  const dishes = r.dishesToAskAbout.slice(0, Math.min(d.dishes, MAX_DISHES));
  if (dishes.length) {
    lines.push(`Dishes to ask about: ${dishes.map((x) => (x.note ? `${x.name} (${x.note})` : x.name)).join(", ")}`);
  }
  const questions = r.needsConfirmation.slice(0, Math.min(d.questions, MAX_QUESTIONS));
  if (questions.length) {
    lines.push("Questions to ask:", ...questions.map((q) => `- ${q}`));
    const more = r.needsConfirmation.length - questions.length;
    if (more > 0) lines.push(`- and ${more} more thing${more === 1 ? "" : "s"} to check`);
  }
  const phone = r.links.phone && telHref(r.links.phone) ? formatPhone(r.links.phone) : null;
  if (phone) lines.push(`Phone: ${phone}`);
  const maps = safeHttpUrl(r.links.mapsUrl);
  if (maps) lines.push(`Map: ${maps}`);
  return lines.join("\n");
}

function assemble(heading: string, blocks: string[], left: number): string {
  const parts = [heading, ...blocks];
  if (left > 0) parts.push(`And ${left} more place${left === 1 ? "" : "s"} on the shortlist.`);
  parts.push(`${SHARE_DISCLAIMER}\n${SITE_URL}`);
  return parts.join("\n\n");
}

/**
 * Plain text for the shortlist, emoji-free so it reads the same in WhatsApp, SMS and email.
 * Detail is reduced step by step to stay within SHARE_TEXT_LIMIT; if even the shortest form is too
 * long, later places are dropped and counted ("And 2 more places on the shortlist.").
 */
export function buildShareText(
  results: readonly RecommendResult[],
  shortlistIds: readonly string[],
  profileName?: string | null,
  limit = SHARE_TEXT_LIMIT,
): string {
  const heading = shareHeading(profileName);
  const places = shortlistedResults(results, shortlistIds);
  if (!places.length) return assemble(heading, [], 0);

  for (let count = places.length; count >= 1; count--) {
    for (const d of DETAIL_LEVELS) {
      const text = assemble(
        heading,
        places.slice(0, count).map((r, i) => placeBlock(r, i + 1, d)),
        places.length - count,
      );
      if (text.length <= limit) return text;
    }
  }
  // One place at the shortest detail is still too long (very long names or links): send it anyway.
  return assemble(heading, [placeBlock(places[0], 1, DETAIL_LEVELS.at(-1)!)], places.length - 1);
}

/** WhatsApp click-to-chat with no recipient: https://wa.me/?text=<URL-encoded text>. */
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
