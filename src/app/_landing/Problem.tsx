import { Photo } from "./Photo";
import { SectionHead } from "./Section";
import styles from "./landing.module.css";

// Claims about the general problem, not statistics.
const ROWS = [
  "Food apps rank by popularity, not by the person you’re feeding.",
  "Ingredient and allergen details are rarely online.",
  "Tastes get assumed from age instead of asked about.",
  "So caregivers phone around and guess.",
] as const;

export function Problem() {
  return (
    <section className={styles.section} aria-labelledby="problem-h">
      <div className={styles.split}>
        <div className={styles.stack}>
          <SectionHead id="problem-h" eyebrow="The problem" title="Choosing for someone else is hard." muted="The usual tools don’t help." />
          <ol className={styles.numbered}>
            {ROWS.map((text, i) => (
              <li key={text} className={styles.numberedRow}>
                <span className={styles.num} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </div>
        <Photo />
      </div>
    </section>
  );
}
