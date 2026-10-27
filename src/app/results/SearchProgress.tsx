"use client";
import { Icon } from "@/components/Icon";
import { toolLabel } from "@/lib/ui/format";
import type { TraceStep } from "@/lib/ui/types";
import styles from "./results.module.css";

/** The real trace steps as they stream in. No invented or timed messages. */
export function SearchProgress({
  who,
  steps,
  fallback,
  onCancel,
}: {
  who: string;
  steps: TraceStep[];
  fallback: boolean;
  onCancel: () => void;
}) {
  return (
    <section className={styles.progress} aria-labelledby="progress-h" aria-busy="true">
      <h1 id="progress-h">Finding places for {who}</h1>
      <p className={styles.muted}>Tastora is asking Qloo and checking each place against their needs.</p>
      <ol className={styles.steps} aria-live="polite" aria-relevant="additions">
        {steps.map((s) => (
          <li key={s.step} className={styles.step}>
            <span className={styles.stepIcon}>
              <Icon name="check" size={16} />
            </span>
            <span>
              <strong>{toolLabel(s.tool)}</strong>
              {s.inputSummary && <span className={styles.stepInput}> — {s.inputSummary}</span>}
              <span className={styles.stepResult}>{s.resultSummary}</span>
            </span>
          </li>
        ))}
        <li className={`${styles.step} ${styles.stepActive}`} aria-hidden="true">
          <span className={styles.spinner} />
          <span>Working…</span>
        </li>
      </ol>
      {fallback && (
        <p className={styles.notice} role="status">
          Live progress isn&rsquo;t available on this connection. Still searching; this usually takes under 15
          seconds.
        </p>
      )}
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Cancel search
      </button>
    </section>
  );
}
