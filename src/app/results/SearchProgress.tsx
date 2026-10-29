"use client";
import { Icon } from "@/components/Icon";
import { plainStep, toolLabel } from "@/lib/ui/format";
import type { TraceStep } from "@/lib/ui/types";
import styles from "./results.module.css";

/**
 * The real trace steps as they stream in, in plain words. No invented or timed messages; the raw
 * steps are kept under "Technical details".
 */
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
      <p className={styles.muted}>
        An AI agent plans the search, Qloo ranks restaurants by taste, and Tastora checks each place against their
        needs.
      </p>
      <ol className={styles.steps} aria-live="polite" aria-relevant="additions">
        {steps.map((s) => {
          const plain = plainStep(s);
          return (
            <li key={s.step} className={styles.step}>
              <span className={styles.stepIcon}>
                <Icon name="check" size={16} />
              </span>
              <span>
                {plain.title}
                {plain.detail && <span className={styles.stepResult}>{plain.detail}</span>}
              </span>
            </li>
          );
        })}
        <li className={`${styles.step} ${styles.stepActive}`} aria-hidden="true">
          <span className={styles.spinner} />
          <span>Working…</span>
        </li>
      </ol>
      {steps.length > 0 && (
        <details className={styles.techDetails}>
          <summary>Technical details ({steps.length} steps)</summary>
          <ol className={styles.traceList}>
            {steps.map((s) => (
              <li key={s.step}>
                <strong>{toolLabel(s.tool)}</strong>
                {s.inputSummary && ` — ${s.inputSummary}`}: {s.resultSummary}
              </li>
            ))}
          </ol>
        </details>
      )}
      {fallback && (
        <p className={styles.notice} role="status">
          Live progress isn&rsquo;t available on this connection. The AI agent is still searching; this usually takes
          under 15 seconds.
        </p>
      )}
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Cancel search
      </button>
    </section>
  );
}
