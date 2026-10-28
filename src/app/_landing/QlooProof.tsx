import { SectionHead } from "./Devices";
import styles from "./landing.module.css";
import { QLOO_PROOF } from "./proofStats";

export function QlooProof() {
  return (
    <section id="qloo" className={styles.section} aria-labelledby="qloo-h">
      <SectionHead id="qloo-h" eyebrow="Why Qloo" title="Taste signals change the answer">
        <p className={styles.headText}>
          Tastora runs every search twice, with and without the person&rsquo;s taste signals, and shows you what changed.
        </p>
      </SectionHead>
      <ul className={styles.stats}>
        {QLOO_PROOF.map((s) => (
          <li key={s.who} className={styles.stat}>
            <p className={styles.statFigure}>{s.figure}</p>
            <p className={styles.statText}>{s.text}</p>
            <p className={styles.statWho}>{s.who}</p>
          </li>
        ))}
      </ul>
      <p className={styles.caption}>From Tastora&rsquo;s test searches, October 2026.</p>
    </section>
  );
}
