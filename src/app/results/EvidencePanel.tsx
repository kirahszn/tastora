"use client";
// "How Qloo shaped these results": built only from the `evidence` object.
import { droppedOut, movementLabel, rankMovement, type Movement } from "@/lib/ui/rankMovement";
import type { QlooEvidence } from "@/lib/ui/types";
import styles from "./results.module.css";

const KIND_LABELS: Record<string, string> = {
  artist: "artist",
  movie: "film",
  tv_show: "TV show",
  book: "book",
  place: "place",
  tag: "taste tag",
};

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

function MovementBadge({ m }: { m: Movement }) {
  const { symbol, text } = movementLabel(m);
  return (
    <span className={`${styles.move} ${styles[`move_${m.kind}`]}`}>
      <span aria-hidden="true">{symbol}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function EvidencePanel({ evidence }: { evidence: QlooEvidence | null }) {
  if (!evidence) {
    return (
      <section className={styles.evidence} aria-labelledby="evidence-h">
        <h2 id="evidence-h">How Qloo shaped these results</h2>
        <p className={styles.muted}>The comparison without taste signals isn&rsquo;t available for this search.</p>
      </section>
    );
  }

  const rows = rankMovement(evidence.baselineTop10, evidence.personalisedTop10);
  const gone = droppedOut(evidence.baselineTop10, evidence.personalisedTop10);
  const n = evidence.personalisedTop10.length;
  const added = n - evidence.overlapCount;
  const cuisine = list(evidence.cuisineTagNames ?? []) || "this cuisine";
  const signals = evidence.signalsUsed.map((s) => s.name);

  return (
    <section className={styles.evidence} aria-labelledby="evidence-h">
      <h2 id="evidence-h">How Qloo shaped these results</h2>

      {signals.length === 0 ? (
        <p>
          No taste memories were used in this search, so Qloo ranked {cuisine} restaurants without them. Add music,
          films or places to the profile to see how their tastes change the list.
        </p>
      ) : (
        <>
          <div>
            <h3 className={styles.evidenceSub}>Taste signals used</h3>
            <ul className={styles.signals}>
              {evidence.signalsUsed.map((s) => (
                <li key={s.id}>
                  <strong>{s.name}</strong> — {KIND_LABELS[s.kind] ?? s.kind}
                </li>
              ))}
            </ul>
          </div>
          <p>
            Tastora asked Qloo for {cuisine} restaurants twice: once on cuisine alone, and once adding{" "}
            {list(signals)}. Of the top {n} with taste signals, {evidence.overlapCount} also appear without them and{" "}
            {added} {added === 1 ? "is" : "are"} new; {evidence.rankChanges} of the {n} sit in a
            different position. These lists show Qloo&rsquo;s own ranking before Tastora checks each place against the
            person&rsquo;s needs and location, so the suggestions above can differ.
          </p>
          <dl className={styles.stats}>
            <div>
              <dt>Same places</dt>
              <dd>
                {evidence.overlapCount} of {n}
              </dd>
            </div>
            <div>
              <dt>New with taste signals</dt>
              <dd>{added}</dd>
            </div>
            <div>
              <dt>Moved position</dt>
              <dd>{evidence.rankChanges}</dd>
            </div>
          </dl>
        </>
      )}

      <details className={styles.details} open={signals.length > 0}>
        <summary>Compare the two top-10 lists</summary>
        <div className={styles.compare}>
          <div>
            <h3 className={styles.evidenceSub}>Without taste signals</h3>
            <ol className={styles.top10}>
              {evidence.baselineTop10.map((p) => (
                <li key={p.id} className={gone.some((g) => g.id === p.id) ? styles.gone : undefined}>
                  {p.name}
                  {gone.some((g) => g.id === p.id) && <span className={styles.goneNote}>left the top 10</span>}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className={styles.evidenceSub}>With taste signals</h3>
            <ol className={styles.top10}>
              {rows.map((row) => (
                <li key={row.id}>
                  {row.name} <MovementBadge m={row.movement} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </section>
  );
}
