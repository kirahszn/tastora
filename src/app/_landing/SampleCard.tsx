import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import styles from "./landing.module.css";
import { SAMPLE_RESULT as r } from "./sampleResult";

/** A real result from the Sinatra example, shown as Tastora shows it (see sampleResult.ts). */
export function SampleCard() {
  return (
    <aside className={styles.sampleWrap} aria-label="Example result">
      <div className={styles.sample}>
        <p className={styles.sampleLabel}>Example · A Sinatra fan in Queens</p>
        <p className={styles.sampleName}>{r.name}</p>
        <p className={styles.samplePlace}>{r.place}</p>

        <p className={styles.sampleHeading}>Why it fits</p>
        <ul className={styles.sampleReasons}>
          {r.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>

        <ul className={styles.sampleChips} aria-label="Their needs">
          {r.statuses.map((s) => (
            <li key={s.requirement}>
              <StatusBadge requirement={s} />
            </li>
          ))}
          <li className={styles.sampleAsk}>
            <Icon name="ask" size={16} />
            {r.question}
          </li>
        </ul>

        <p className={styles.sampleNote}>Tastora suggests what to check. It can&rsquo;t confirm ingredients or allergens.</p>
      </div>
    </aside>
  );
}
