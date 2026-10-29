import styles from "./landing.module.css";
import { SectionHead } from "./Section";

// Simple line drawings of each step (decorative; the text carries the meaning).
const DRAWINGS = {
  tastes: (
    <>
      <rect x="22" y="14" width="76" height="62" rx="8" />
      <path d="M34 30h30M34 42h22M34 54h26" />
      <path d="M80 50c0-6 9-8 9-1 0 6-9 11-9 11s-9-5-9-11c0-7 9-5 9 1z" className={styles.drawAccent} />
      <path d="M74 24v12M74 24l8-2v10" />
      <circle cx="72" cy="36" r="2.5" />
      <circle cx="80" cy="33" r="2.5" />
    </>
  ),
  search: (
    <>
      <path d="M18 22h56M18 38h46M18 54h52M18 70h40" />
      <circle cx="84" cy="50" r="15" />
      <path d="M95 61l10 10" />
      <path d="M78 50l4 4 8-8" className={styles.drawAccent} />
    </>
  ),
  share: (
    <>
      <rect x="22" y="10" width="40" height="70" rx="8" />
      <path d="M36 72h12" />
      <path d="M32 26l3 3 6-6M32 42l3 3 6-6M45 26h8M45 42h8" />
      <path d="M70 26h28a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H84l-8 8v-8h-6a6 6 0 0 1-6-6V32a6 6 0 0 1 6-6z" className={styles.drawAccent} />
      <path d="M76 38h16M76 45h10" />
    </>
  ),
};

const STEPS = [
  {
    drawing: DRAWINGS.tastes,
    title: "Tell us their tastes",
    text: "Favourite foods, the singers and films they love, and anything they must avoid.",
  },
  {
    drawing: DRAWINGS.search,
    title: "Tastora searches with Qloo",
    text: "An AI agent plans the search. Qloo ranks restaurants near them by taste. Tested code checks every need.",
  },
  {
    drawing: DRAWINGS.share,
    title: "Share and call ahead",
    text: "Send a shortlist to family, or print the questions to ask the restaurant before you go.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className={styles.section} aria-labelledby="how-h">
      <SectionHead id="how-h" eyebrow="How it works" title="Three steps." muted="No account needed." />
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <svg viewBox="0 0 120 90" className={styles.drawing} aria-hidden="true" focusable="false">
              {s.drawing}
            </svg>
            <p className={styles.stepNum} aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h3 className={styles.stepTitle}>{s.title}</h3>
            <p className={styles.stepText}>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
