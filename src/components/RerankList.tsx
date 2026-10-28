"use client";
// A top-10 list whose rows glide to their new positions (see useFlip). Used by the landing page's "Watch
// Qloo re-rank" section and the results page's evidence panel; both pass real Qloo lists only.
import { movementLabel, type Movement } from "@/lib/ui/rankMovement";
import styles from "./RerankList.module.css";

export interface RerankRow {
  id: string;
  name: string;
  /** Neighbourhood, when known. */
  area?: string | null;
  /** Position change against the plain list; omitted for the plain list itself. */
  movement?: Movement;
}

export function MovementBadge({ m }: { m: Movement }) {
  const { symbol, text } = movementLabel(m);
  return (
    <span className={`${styles.move} ${styles[m.kind]}`}>
      <span aria-hidden="true">{m.kind === "new" ? "New" : symbol}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function RerankList({
  rows,
  listRef,
  label,
}: {
  rows: readonly RerankRow[];
  listRef?: React.Ref<HTMLOListElement>;
  /** Accessible name of the list. */
  label: string;
}) {
  return (
    <ol ref={listRef} className={styles.list} aria-label={label}>
      {rows.map((row, i) => (
        <li key={row.id} data-flip={row.id} className={styles.row}>
          <span className={styles.rank} aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className={styles.place}>
            <span className={styles.name}>{row.name}</span>
            {row.area && <span className={styles.area}>{row.area}</span>}
          </span>
          {row.movement && <MovementBadge m={row.movement} />}
        </li>
      ))}
    </ol>
  );
}
