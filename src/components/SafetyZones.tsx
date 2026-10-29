// A place's needs as distinct zones (Phase 12), the same on the hero preview, the landing demo, the
// results cards and the print checklist. Each zone differs by shape, icon and text, never colour
// alone: Matched is a solid row with ✓ and its source, To confirm a dashed box with ? (allergies and
// texture can only land here, see needZones/displayStatus), Conflict a solid heavy row with ⛔, and
// the questions a numbered call script with the Call button attached when Qloo lists a phone.
import { needName, needZones } from "@/lib/ui/status";
import type { RequirementResult } from "@/lib/ui/types";
import { Icon } from "./Icon";
import styles from "./SafetyZones.module.css";

type Need = Pick<RequirementResult, "kind" | "status" | "requirement">;

export function SafetyZones({
  statuses,
  questions = [],
  call,
  heading: Heading = "h4",
  compact = false,
}: {
  statuses: readonly Need[];
  questions?: readonly string[];
  /** Attach a Call button to the questions. Without `href` it is drawn but not a link (previews). */
  call?: { href?: string | null; name: string } | null;
  heading?: "h3" | "h4" | "p";
  compact?: boolean;
}) {
  const { matched, conflicts, confirm } = needZones(statuses);
  const hasZones = matched.length + conflicts.length + confirm.length > 0;

  return (
    <div className={`${styles.zones} ${compact ? styles.compact : ""}`}>
      {hasZones && (
        <ul className={styles.list} aria-label="Their needs">
          {conflicts.map((s) => (
            <li key={s.requirement} className={`${styles.zone} ${styles.bad}`}>
              <Icon name="ban" size={compact ? 15 : 18} />
              <span>
                <strong>Conflict</strong> · {needName(s)}.{" "}
                <span className={styles.reason}>Qloo&rsquo;s tags contradict this need.</span>
              </span>
            </li>
          ))}
          {matched.map((s) => (
            <li key={s.requirement} className={`${styles.zone} ${styles.ok}`}>
              <Icon name="check" size={compact ? 15 : 18} />
              <span>
                <strong>Matched</strong> · {needName(s)}
              </span>
              <span className={styles.source}>{s.kind === "diet" ? "venue tag, confirm" : "venue tag"}</span>
            </li>
          ))}
          {confirm.length > 0 && (
            <li className={`${styles.zone} ${styles.warn}`}>
              <Icon name="question" size={compact ? 15 : 18} />
              <span className={styles.confirm}>
                <strong>To confirm</strong>
                <span className={styles.confirmItems}>
                  {confirm.map((c) => (
                    <span key={c} className={styles.confirmItem}>
                      {c}
                    </span>
                  ))}
                </span>
              </span>
            </li>
          )}
        </ul>
      )}

      {questions.length > 0 && (
        <div className={styles.script}>
          <Heading className={styles.scriptTitle}>
            <Icon name="ask" size={compact ? 15 : 18} /> Ask the restaurant
          </Heading>
          <ol className={styles.questions}>
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
          {call &&
            (call.href ? (
              <a className={`btn btn-primary ${styles.call}`} href={call.href}>
                <Icon name="phone" /> Call<span className="sr-only"> {call.name}</span>
              </a>
            ) : (
              <span className={`btn btn-primary ${styles.call}`} aria-hidden="true">
                <Icon name="phone" /> Call
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
