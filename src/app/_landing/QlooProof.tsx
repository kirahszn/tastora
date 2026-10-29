import { SectionHead } from "./Section";
import styles from "./landing.module.css";
import { QLOO_PROOF } from "./proofStats";

export function QlooProof() {
  return (
    <section id="qloo" className={styles.section} aria-labelledby="proof-h">
      <SectionHead id="proof-h" eyebrow="Why Qloo" title="Taste signals change the answer." muted="We measured it.">
        <p>Every search runs twice, with and without the person&rsquo;s taste signals. Three real examples:</p>
      </SectionHead>
      <ul className={styles.stats}>
        {QLOO_PROOF.map((s) => (
          <li key={s.who} className={`card ${styles.stat}`}>
            <p className={styles.statFigure}>{s.figure}</p>
            <p className={styles.statText}>{s.text}</p>
            <p className="mono">{s.who}</p>
          </li>
        ))}
      </ul>
      <p className="mono">From Tastora&rsquo;s test searches in New York City, October 2026.</p>
    </section>
  );
}
