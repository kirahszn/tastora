import { SectionHead } from "./Devices";
import styles from "./landing.module.css";

const STEPS = [
  { title: "Tell us their tastes", text: "Favourite foods, taste memories, and anything they must avoid." },
  {
    title: "Tastora searches with Qloo",
    text: "Claude plans the search; Qloo ranks NYC restaurants by taste; Tastora checks every need.",
  },
  {
    title: "Share and call ahead",
    text: "Send the shortlist to family, then ask the restaurant the questions on your checklist.",
  },
];

export function Steps() {
  return (
    <section className={styles.section} aria-labelledby="steps-h">
      <SectionHead id="steps-h" eyebrow="Get started" title="Three steps to a good meal out" />
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">
              {i + 1}
            </span>
            <div className={styles.stepCard}>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
