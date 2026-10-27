"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ListInput } from "@/components/ListInput";
import formStyles from "@/components/form.module.css";
import { useHydrated } from "@/components/useHydrated";
import { BOROUGHS } from "@/lib/domain/borough";
import type { TextureNeed } from "@/lib/domain/profile";
import {
  EXAMPLES,
  NEIGHBOURHOOD_MAX,
  emptyDraft,
  profileToDraft,
  validateDraft,
  type DraftErrors,
  type DraftField,
  type ProfileDraft,
} from "@/lib/ui/profileDraft";
import { clearAll, clearLastSearch, emptyFeedback, loadProfile, saveFeedback, saveProfile } from "@/lib/ui/storage";
import styles from "./profile.module.css";

const CUISINES = [
  "Nigerian",
  "Jamaican",
  "Italian",
  "Italian-American",
  "Chinese",
  "Soul food",
  "Jewish deli",
  "Puerto Rican",
  "Mexican",
  "Greek",
  "Indian",
  "Polish",
];
const DISHES = ["jollof rice", "chicken parm", "oxtail", "matzo ball soup", "dumplings", "rice and peas"];
const ALLERGIES = ["Peanut", "Tree nuts", "Shellfish", "Fish", "Egg", "Milk", "Sesame", "Soy", "Wheat"];
const DIETS = ["Halal", "Kosher", "Vegetarian", "Vegan", "No pork", "Gluten-free", "Dairy-free"];
const TEXTURES: { value: TextureNeed; label: string; hint: string }[] = [
  { value: "none", label: "None", hint: "No texture needs" },
  { value: "soft", label: "Soft food", hint: "Soft dishes only" },
  { value: "easy_to_chew", label: "Easy to chew", hint: "Tender, easy to chew" },
];

/** Fields in form sequence, for the error summary. */
const FIELD_LABELS: [DraftField, string][] = [
  ["displayName", "Name"],
  ["favouriteCuisines", "Favourite cuisines"],
  ["favouriteDishes", "Favourite dishes"],
  ["music", "Music"],
  ["films", "Films and TV"],
  ["places", "Places they love"],
  ["dislikes", "Dislikes"],
  ["allergies", "Allergies"],
  ["dietaryRestrictions", "Dietary restrictions"],
  ["borough", "Borough"],
  ["neighbourhood", "Neighbourhood"],
];

export function ProfileForm() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className={styles.page}>
        <h1>Tell us about them</h1>
        <p className={styles.loading}>Loading the form…</p>
      </div>
    );
  }
  return <Form />;
}

function Form() {
  const router = useRouter();
  const [saved] = useState(() => loadProfile());
  const [draft, setDraft] = useState<ProfileDraft>(() => (saved ? profileToDraft(saved) : emptyDraft()));
  const [hasSaved, setHasSaved] = useState(saved !== null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [announcement, setAnnouncement] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const examplesRef = useRef<HTMLElement>(null);

  // /profile#examples (from "Try an example"): the section only exists after hydration.
  useEffect(() => {
    if (window.location.hash === "#examples") examplesRef.current?.scrollIntoView();
  }, []);

  const set = <K extends DraftField>(key: K, value: ProfileDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const loadExample = (id: string) => {
    const example = EXAMPLES.find((e) => e.id === id)!;
    setDraft(structuredClone(example.draft));
    setErrors({});
    // Feedback and cached results belong to the previous person.
    saveFeedback(emptyFeedback());
    clearLastSearch();
    setAnnouncement(`Example loaded: ${example.title}. Review it below, then choose Find restaurants.`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      // After the summary renders. (rAF would stall in a background tab.)
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    saveProfile(result.profile);
    router.push("/results");
  };

  const onClear = () => {
    clearAll();
    setDraft(emptyDraft());
    setErrors({});
    setHasSaved(false);
    setConfirmClear(false);
    setAnnouncement("Profile cleared from this device.");
  };

  const errorList = FIELD_LABELS.filter(([f]) => errors[f]);
  const err = (f: DraftField) => errors[f];

  return (
    <div className={styles.page}>
      <h1>Tell us about them</h1>
      <p className={styles.intro}>
        Only cuisines and a borough are needed. Everything else helps Tastora find places that feel familiar and
        flag what to check.
      </p>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <section id="examples" ref={examplesRef} className={styles.examples} aria-labelledby="examples-h">
        <h2 id="examples-h">Try an example</h2>
        <p className={styles.hint}>Fill the form with an example person. You can change anything before searching.</p>
        <div className={styles.exampleGrid}>
          {EXAMPLES.map((ex) => (
            <button key={ex.id} type="button" className={styles.exampleCard} onClick={() => loadExample(ex.id)}>
              <span className={styles.exampleTitle}>{ex.title}</span>
              <span className={styles.exampleSummary}>{ex.summary}</span>
              <span className={styles.exampleCta}>Use this example</span>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={onSubmit} noValidate className={styles.form}>
        {errorList.length > 0 && (
          <div ref={summaryRef} tabIndex={-1} className={styles.errorSummary} role="alert" aria-labelledby="err-h">
            <h2 id="err-h">Please check {errorList.length === 1 ? "one thing" : `${errorList.length} things`}</h2>
            <ul>
              {errorList.map(([f, label]) => (
                <li key={f}>
                  <a href={`#f-${f}`}>
                    {label}: {errors[f]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <section className={styles.section} aria-labelledby="who-h">
          <h2 id="who-h">Who is this for?</h2>
          <div className={formStyles.field}>
            <label htmlFor="f-displayName" className={formStyles.label}>
              A short name <span className={styles.optional}>(optional)</span>
            </label>
            <p id="f-displayName-hint" className={formStyles.hint}>
              Just what you call them, like &ldquo;Mum&rdquo; or &ldquo;Uncle Joe&rdquo;. It stays on this device.
            </p>
            <input
              id="f-displayName"
              className={formStyles.input}
              value={draft.displayName}
              maxLength={40}
              autoComplete="off"
              aria-describedby="f-displayName-hint"
              aria-invalid={err("displayName") ? true : undefined}
              onChange={(e) => set("displayName", e.target.value)}
            />
            {err("displayName") && <p className={formStyles.error}>{err("displayName")}</p>}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="love-h">
          <h2 id="love-h">What they love</h2>
          <ListInput
            id="f-favouriteCuisines"
            label="Favourite cuisines"
            hint="At least one. Pick from the list or type your own."
            values={draft.favouriteCuisines}
            onChange={(v) => set("favouriteCuisines", v)}
            suggestions={CUISINES}
            max={5}
            maxLength={60}
            placeholder="e.g. Ghanaian"
            error={err("favouriteCuisines")}
          />
          <ListInput
            id="f-favouriteDishes"
            label="Favourite dishes"
            hint="Optional. Tastora looks for these on each restaurant's listed dishes."
            values={draft.favouriteDishes}
            onChange={(v) => set("favouriteDishes", v)}
            suggestions={DISHES}
            max={10}
            maxLength={80}
            placeholder="e.g. egusi soup"
            error={err("favouriteDishes")}
          />
        </section>

        <section className={styles.section} aria-labelledby="mem-h">
          <h2 id="mem-h">Taste memories</h2>
          <p className={styles.sectionHint}>
            Music, films and places they love help Qloo find restaurants enjoyed by people with similar tastes, so
            the food is more likely to feel familiar. All optional.
          </p>
          <ListInput
            id="f-music"
            label="Music"
            hint="Singers or bands, for example Fela Kuti or Frank Sinatra."
            values={draft.music}
            onChange={(v) => set("music", v)}
            max={5}
            maxLength={80}
            placeholder="e.g. Fela Kuti"
            error={err("music")}
          />
          <ListInput
            id="f-films"
            label="Films and TV"
            hint="For example The Godfather or Living in Bondage."
            values={draft.films}
            onChange={(v) => set("films", v)}
            max={5}
            maxLength={80}
            placeholder="e.g. The Godfather"
            error={err("films")}
          />
          <ListInput
            id="f-places"
            label="Places they love"
            hint="Cities or places with good memories, for example Lagos or Naples."
            values={draft.places}
            onChange={(v) => set("places", v)}
            max={5}
            maxLength={80}
            placeholder="e.g. Naples"
            error={err("places")}
          />
        </section>

        <section className={styles.section} aria-labelledby="dislike-h">
          <h2 id="dislike-h">What they don&rsquo;t like</h2>
          <ListInput
            id="f-dislikes"
            label="Dislikes"
            hint="Optional. Dishes naming these are left out and the place ranks a little lower."
            values={draft.dislikes}
            onChange={(v) => set("dislikes", v)}
            max={15}
            maxLength={60}
            placeholder="e.g. okra"
            error={err("dislikes")}
          />
        </section>

        <section className={`${styles.section} ${styles.mustAvoid}`} aria-labelledby="avoid-h">
          <h2 id="avoid-h">
            <span aria-hidden="true">⚠ </span>Must avoid
          </h2>
          <p className={styles.sectionHint}>
            These are checked by Tastora&rsquo;s own rules, never treated as safe. Restaurants don&rsquo;t share
            ingredient data, so you&rsquo;ll always see what to confirm with them.
          </p>
          <ListInput
            id="f-allergies"
            label="Allergies"
            values={draft.allergies}
            onChange={(v) => set("allergies", v)}
            suggestions={ALLERGIES}
            max={10}
            maxLength={60}
            placeholder="e.g. peanut"
            error={err("allergies")}
          />
          <ListInput
            id="f-dietaryRestrictions"
            label="Dietary restrictions"
            values={draft.dietaryRestrictions}
            onChange={(v) => set("dietaryRestrictions", v)}
            suggestions={DIETS}
            max={10}
            maxLength={60}
            placeholder="e.g. halal"
            error={err("dietaryRestrictions")}
          />
          <fieldset className={styles.fieldset}>
            <legend className={formStyles.label}>Texture</legend>
            <div className={styles.radios}>
              {TEXTURES.map((t) => (
                <label key={t.value} className={styles.radio}>
                  <input
                    type="radio"
                    name="texture"
                    value={t.value}
                    checked={draft.texture === t.value}
                    onChange={() => set("texture", t.value)}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className={styles.section} aria-labelledby="comfort-h">
          <h2 id="comfort-h">Comfort</h2>
          <p className={styles.sectionHint}>Optional. Only checked if you tick them.</p>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={draft.quietPreferred}
              onChange={(e) => set("quietPreferred", e.target.checked)}
            />
            <span>A quiet place</span>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={draft.wheelchairAccess}
              onChange={(e) => set("wheelchairAccess", e.target.checked)}
            />
            <span>Wheelchair access</span>
          </label>
        </section>

        <section className={styles.section} aria-labelledby="where-h">
          <h2 id="where-h">Where</h2>
          <div className={formStyles.field}>
            <label htmlFor="f-borough" className={formStyles.label}>
              Borough
            </label>
            <select
              id="f-borough"
              className={formStyles.select}
              value={draft.borough}
              aria-invalid={err("borough") ? true : undefined}
              aria-describedby={err("borough") ? "f-borough-err" : undefined}
              onChange={(e) => set("borough", e.target.value as ProfileDraft["borough"])}
            >
              <option value="">Choose a borough</option>
              {BOROUGHS.map((b) => (
                <option key={b} value={b}>
                  {b === "Bronx" ? "The Bronx" : b}
                </option>
              ))}
            </select>
            {err("borough") && (
              <p id="f-borough-err" className={formStyles.error}>
                {err("borough")}
              </p>
            )}
          </div>
          <div className={formStyles.field}>
            <label htmlFor="f-neighbourhood" className={formStyles.label}>
              Neighbourhood <span className={styles.optional}>(optional)</span>
            </label>
            <input
              id="f-neighbourhood"
              className={formStyles.input}
              value={draft.neighbourhood}
              maxLength={NEIGHBOURHOOD_MAX}
              placeholder="e.g. Bed-Stuy"
              autoComplete="off"
              aria-invalid={err("neighbourhood") ? true : undefined}
              onChange={(e) => set("neighbourhood", e.target.value)}
            />
            {err("neighbourhood") && <p className={formStyles.error}>{err("neighbourhood")}</p>}
          </div>
          <p className={styles.sectionHint}>
            Places in this borough rank a little higher. Nearby places can still appear, clearly labelled.
          </p>
        </section>

        <aside className={styles.privacy} aria-labelledby="privacy-h">
          <h2 id="privacy-h">Your privacy</h2>
          <ul>
            <li>This profile is saved in this browser, on this device only.</li>
            <li>
              When you search, it goes to Tastora&rsquo;s server (without the name, which never leaves this device).
              Their favourite foods, dislikes and taste memories are sent to Claude, an AI model, which plans
              searches on Qloo using those tastes and the area.
            </li>
            <li>
              Allergies, dietary restrictions, texture and comfort needs are checked by Tastora&rsquo;s own code.
              They are not sent to the AI model or to Qloo.
            </li>
          </ul>
        </aside>

        <div className={styles.submitRow}>
          <button type="submit" className="btn btn-primary">
            Find restaurants
          </button>
          {hasSaved && !confirmClear && (
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmClear(true)}>
              Clear profile
            </button>
          )}
        </div>
        {confirmClear && (
          <div className={styles.confirm} role="group" aria-labelledby="confirm-h">
            <p id="confirm-h">
              Clear this profile and its feedback from this device? This can&rsquo;t be undone.
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className="btn btn-primary" onClick={onClear}>
                Yes, clear it
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmClear(false)} autoFocus>
                Keep it
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
