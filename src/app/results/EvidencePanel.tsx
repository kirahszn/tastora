"use client";
// "How Qloo shaped these results": built only from the `evidence` object. The two top-10 lists use
// the landing page's re-rank list: switch between them and the rows glide to their new places.
import { useState } from "react";
import { RerankList } from "@/components/RerankList";
import { useFlip } from "@/components/useFlip";
import { droppedOut, evidenceSentence, joinList as list, rankMovement } from "@/lib/ui/rankMovement";
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

export function EvidencePanel({ evidence }: { evidence: QlooEvidence | null }) {
  const [withSignals, setWithSignals] = useState(true);
  const { ref, capture } = useFlip<HTMLOListElement>();

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
  const lead = evidenceSentence(evidence);
  const showPersonalised = signals.length > 0 && withSignals;

  const choose = (next: boolean) => {
    if (next === withSignals) return;
    capture();
    setWithSignals(next);
  };

  return (
    <section className={styles.evidence} aria-labelledby="evidence-h">
      <h2 id="evidence-h">How Qloo shaped these results</h2>
      {lead && <p className={styles.evidenceLead}>{lead}</p>}

      {signals.length === 0 ? (
        <p>
          No taste signals shaped this search, so Qloo ranked {cuisine} restaurants by cuisine and area alone. Music,
          films or places that Qloo recognises change this list; you can add them to the profile.
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

      <div className={styles.evidenceList}>
        <h3 className={styles.evidenceSub}>Qloo&rsquo;s top {n || evidence.baselineTop10.length}</h3>
        {signals.length > 0 && (
          <div className={styles.evidenceChips} role="group" aria-label="Which list to show">
            <button type="button" className="chip" aria-pressed={withSignals} onClick={() => choose(true)}>
              With {list(signals)}
            </button>
            <button type="button" className="chip" aria-pressed={!withSignals} onClick={() => choose(false)}>
              Without taste signals
            </button>
          </div>
        )}
        <RerankList
          listRef={ref}
          label={showPersonalised ? "Top 10 with taste signals, with movement" : "Top 10 without taste signals"}
          rows={showPersonalised ? rows : evidence.baselineTop10}
        />
        {showPersonalised && gone.length > 0 && (
          <p className={styles.muted}>
            Left the top 10: {list(gone.map((g) => g.name))}.
          </p>
        )}
      </div>
    </section>
  );
}
