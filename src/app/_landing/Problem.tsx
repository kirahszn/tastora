import { Icon } from "@/components/Icon";
import { SectionHead } from "./Devices";
import styles from "./landing.module.css";
import { Photo } from "./Photo";

// Claims about the general problem, not statistics.
const ROWS = [
  { icon: "star", tint: styles.tintPeach, text: "Food apps rank by popularity, not by the person you’re feeding." },
  { icon: "info", tint: styles.tintButter, text: "Ingredient and allergen details are rarely online." },
  { icon: "question", tint: styles.tintLavender, text: "Tastes get assumed from age instead of asked about." },
  { icon: "phone", tint: styles.tintSage, text: "So caregivers end up phoning around, guessing." },
] as const;

export function Problem() {
  return (
    <section className={styles.section} aria-labelledby="problem-h">
      <SectionHead id="problem-h" eyebrow="The problem" title="Finding food they’ll love shouldn’t be guesswork" />
      <div className={styles.problem}>
        <Photo />
        <ul className={styles.problemList}>
          {ROWS.map((r) => (
            <li key={r.text} className={styles.problemRow}>
              <span className={`${styles.tile} ${r.tint}`}>
                <Icon name={r.icon} size={24} />
              </span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
