import { Icon } from "@/components/Icon";
import styles from "./landing.module.css";

const STEPS = [
  {
    icon: "heart",
    tint: styles.tintPeach,
    title: "Their tastes",
    text: "Favourite foods and taste memories, like a singer they love.",
  },
  {
    icon: "shield",
    tint: styles.tintSage,
    title: "Their needs",
    text: "Allergies, diet, texture and comfort, checked by Tastora’s own rules.",
  },
  {
    icon: "sparkle",
    tint: styles.tintButter,
    title: "Why this place",
    text: "Every match explained from Qloo’s data and their profile.",
  },
  {
    icon: "ask",
    tint: styles.tintLavender,
    title: "What to ask",
    text: "Dishes to try and questions for the restaurant before you go.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className={styles.how} aria-labelledby="how-h">
      <h2 id="how-h" className={styles.sectionTitle}>
        From a favourite song to the right table
      </h2>
      <ul className={styles.howGrid}>
        {STEPS.map((s) => (
          <li key={s.title} className={styles.howCard}>
            <span className={`${styles.tile} ${s.tint}`}>
              <Icon name={s.icon} size={24} />
            </span>
            <h3 className={styles.howTitle}>{s.title}</h3>
            <p className={styles.howText}>{s.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
