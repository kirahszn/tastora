// The profile form's state, its conversion to/from `SeniorProfile`, client-side validation with
// the same Zod schema the server uses, and the two example profiles.
import { BOROUGHS, detectProfileBorough, type Borough } from "@/lib/domain/borough";
import { SeniorProfileSchema, type SeniorProfile, type TextureNeed } from "@/lib/domain/profile";

export interface ProfileDraft {
  displayName: string;
  favouriteCuisines: string[];
  favouriteDishes: string[];
  music: string[];
  films: string[];
  places: string[];
  dislikes: string[];
  allergies: string[];
  dietaryRestrictions: string[];
  texture: TextureNeed;
  quietPreferred: boolean;
  wheelchairAccess: boolean;
  borough: Borough | "";
  neighbourhood: string;
}

export type DraftField = keyof ProfileDraft;

export const emptyDraft = (): ProfileDraft => ({
  displayName: "",
  favouriteCuisines: [],
  favouriteDishes: [],
  music: [],
  films: [],
  places: [],
  dislikes: [],
  allergies: [],
  dietaryRestrictions: [],
  texture: "none",
  quietPreferred: false,
  wheelchairAccess: false,
  borough: "",
  neighbourhood: "",
});

export const NEIGHBOURHOOD_MAX = 60;

export function composeLocation(borough: string, neighbourhood: string): string {
  const n = neighbourhood.trim();
  return n ? `${n}, ${borough}` : borough;
}

export function draftToInput(d: ProfileDraft) {
  const name = d.displayName.trim();
  return {
    ...(name ? { displayName: name } : {}),
    favouriteCuisines: d.favouriteCuisines,
    favouriteDishes: d.favouriteDishes,
    tasteMemories: { music: d.music, films: d.films, places: d.places },
    dislikes: d.dislikes,
    allergies: d.allergies,
    dietaryRestrictions: d.dietaryRestrictions,
    texture: d.texture,
    comfort: { quietPreferred: d.quietPreferred, wheelchairAccess: d.wheelchairAccess },
    location: d.borough ? composeLocation(d.borough, d.neighbourhood) : "",
  };
}

export function profileToDraft(p: SeniorProfile): ProfileDraft {
  const borough = detectProfileBorough(p.location) ?? "";
  // Strip the borough back off "Bed-Stuy, Brooklyn"; keep any other text as the neighbourhood.
  const neighbourhood = borough
    ? p.location.replace(new RegExp(`,?\\s*(the\\s+)?${borough}\\s*$`, "i"), "").trim()
    : p.location;
  return {
    displayName: p.displayName ?? "",
    favouriteCuisines: [...p.favouriteCuisines],
    favouriteDishes: [...p.favouriteDishes],
    music: [...p.tasteMemories.music],
    films: [...p.tasteMemories.films],
    places: [...p.tasteMemories.places],
    dislikes: [...p.dislikes],
    allergies: [...p.allergies],
    dietaryRestrictions: [...p.dietaryRestrictions],
    texture: p.texture,
    quietPreferred: p.comfort.quietPreferred,
    wheelchairAccess: p.comfort.wheelchairAccess,
    borough,
    neighbourhood: neighbourhood.toLowerCase() === (borough as string).toLowerCase() ? "" : neighbourhood,
  };
}

/** Plain, kind messages per field; Zod's own message is the fallback. */
const MESSAGES: Partial<Record<DraftField, { tooSmall?: string; tooBig?: string }>> = {
  favouriteCuisines: { tooSmall: "Add at least one cuisine they love.", tooBig: "Up to 5 cuisines, please." },
  favouriteDishes: { tooBig: "Up to 10 dishes, please." },
  music: { tooBig: "Up to 5 music memories, please." },
  films: { tooBig: "Up to 5 films or shows, please." },
  places: { tooBig: "Up to 5 places, please." },
  dislikes: { tooBig: "Up to 15 dislikes, please." },
  allergies: { tooBig: "Up to 10 allergies, please." },
  dietaryRestrictions: { tooBig: "Up to 10 dietary needs, please." },
  displayName: { tooBig: "Please keep the name short (40 characters or fewer)." },
};

function fieldFor(path: readonly PropertyKey[]): DraftField {
  const [first, second] = path.map(String);
  if (first === "tasteMemories") return (second as DraftField) ?? "music";
  if (first === "comfort") return second as DraftField;
  if (first === "location") return "borough";
  return first as DraftField;
}

export type DraftErrors = Partial<Record<DraftField, string>>;

export function validateDraft(d: ProfileDraft): { ok: true; profile: SeniorProfile } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};
  if (!d.borough || !BOROUGHS.includes(d.borough)) errors.borough = "Choose the borough you'd like to eat in.";
  if (d.neighbourhood.trim().length > NEIGHBOURHOOD_MAX) {
    errors.neighbourhood = `Please keep the neighbourhood to ${NEIGHBOURHOOD_MAX} characters or fewer.`;
  }
  const parsed = SeniorProfileSchema.safeParse(draftToInput(d));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = fieldFor(issue.path);
      if (errors[field]) continue;
      const custom = MESSAGES[field];
      // A numeric path segment means one entry of a list, not the list itself.
      const entryIssue = issue.path.some((p) => typeof p === "number");
      errors[field] = entryIssue
        ? "One of these entries is too long. Please shorten it."
        : issue.code === "too_small"
          ? (custom?.tooSmall ?? "Please fill this in.")
          : issue.code === "too_big"
            ? (custom?.tooBig ?? issue.message)
            : issue.message;
    }
  }
  if (Object.keys(errors).length || !parsed.success) return { ok: false, errors };
  return { ok: true, profile: parsed.data };
}

export interface ExampleProfile {
  id: "sinatra" | "fela";
  title: string;
  summary: string;
  draft: ProfileDraft;
}

// Sinatra first: its taste signal changes Qloo's list the most (4 of 10 places shared live).
export const EXAMPLES: readonly ExampleProfile[] = [
  {
    id: "sinatra",
    title: "Italian-American in Queens",
    summary: "Loves chicken parm and Frank Sinatra. No pork, needs wheelchair access.",
    draft: {
      ...emptyDraft(),
      displayName: "Dad",
      favouriteCuisines: ["Italian-American"],
      favouriteDishes: ["chicken parm"],
      music: ["Frank Sinatra"],
      dietaryRestrictions: ["no pork"],
      wheelchairAccess: true,
      borough: "Queens",
    },
  },
  {
    id: "fela",
    title: "Nigerian food in Brooklyn",
    summary: "Loves jollof rice and Fela Kuti. Peanut allergy, needs soft food.",
    draft: {
      ...emptyDraft(),
      displayName: "Mum",
      favouriteCuisines: ["Nigerian"],
      favouriteDishes: ["jollof rice"],
      music: ["Fela Kuti"],
      allergies: ["peanut"],
      texture: "soft",
      borough: "Brooklyn",
    },
  },
];

export const exampleById = (id: ExampleProfile["id"]) => EXAMPLES.find((e) => e.id === id)!;
