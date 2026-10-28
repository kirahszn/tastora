"use client";
// "Watch Qloo re-rank": the same Qloo request (Italian restaurants, New York City) with no taste
// signal and with one artist as the signal. Every list is real: rerankSnapshot.json is built by
// scripts/landing-rerank.ts from stored Qloo responses (Phase 1 probe, 2026-10-26; Bob Marley and
// a repeat of the plain search captured 2026-10-28, which returned the identical top 10). Movement and the sentence come from the app's own rankMovement/evidenceSentence.
import { useState } from "react";
import { RerankList, type RerankRow } from "@/components/RerankList";
import { useFlip } from "@/components/useFlip";
import { droppedOut, evidenceSentence, rankMovement } from "@/lib/ui/rankMovement";
import snapshot from "./rerankSnapshot.json";
import { SectionHead } from "./Section";
import styles from "./landing.module.css";

const baseline = snapshot.baseline.top10;
/** Rows shown; movement and the sentence still compare the full top 10s. */
const SHOWN = 6;

function view(signal: number | null) {
  if (signal === null) {
    return {
      rows: baseline as RerankRow[],
      sentence: `A plain search: Qloo’s top 10 ${snapshot.cuisine} restaurants in ${snapshot.city}, with no taste signal.`,
      left: 0,
    };
  }
  const s = snapshot.signals[signal];
  const moves = rankMovement(baseline, s.top10);
  const ids = new Set(baseline.map((p) => p.id));
  const sentence = evidenceSentence({
    signalsUsed: [{ id: s.source, name: s.name, kind: "artist" }],
    personalisedTop10: s.top10,
    overlapCount: s.top10.filter((p) => ids.has(p.id)).length,
    rankChanges: s.top10.filter((p, i) => baseline[i]?.id !== p.id).length,
  });
  return {
    rows: s.top10.map((p, i) => ({ ...p, movement: moves[i].movement })),
    sentence: sentence ?? "",
    left: droppedOut(baseline, s.top10).length,
  };
}

export function Rerank() {
  const [signal, setSignal] = useState<number | null>(null);
  const { ref, capture } = useFlip<HTMLOListElement>();
  const { rows, sentence, left } = view(signal);

  const choose = (next: number | null) => {
    if (next === signal) return;
    capture();
    setSignal(next);
  };

  return (
    <section id="qloo" className={styles.section} aria-labelledby="qloo-h">
      <div className={styles.split}>
        <div className={styles.stack}>
          <SectionHead id="qloo-h" eyebrow="Watch Qloo re-rank" title="Same city. Same cuisine." muted="Different person.">
            <p>
              Here are Qloo&rsquo;s top 10 {snapshot.cuisine} restaurants in {snapshot.city}. Pick someone&rsquo;s
              favourite singer and the list changes. Tastora runs this comparison on every search and shows you the
              result.
            </p>
          </SectionHead>
          <div className={styles.chips} role="group" aria-label="Taste memory">
            <button type="button" className="chip" aria-pressed={signal === null} onClick={() => choose(null)}>
              Plain search
            </button>
            {snapshot.signals.map((s, i) => (
              <button key={s.name} type="button" className="chip" aria-pressed={signal === i} onClick={() => choose(i)}>
                {s.name}
              </button>
            ))}
          </div>
          <p className={styles.liveSentence} aria-live="polite">
            {sentence}
            {left > 0 && <span className="tone-muted"> {left === 1 ? "1 place" : `${left} places`} left the top 10.</span>}
          </p>
          <p className="mono">
            Real Qloo results from test searches, October 2026. Same request each time; only the taste signal changes.
          </p>
        </div>
        <div className={`card ${styles.rerankCard}`}>
          <p className={styles.rerankHead}>
            <span>{signal === null ? "No taste signal" : `Fan of ${snapshot.signals[signal].name}`}</span>
            <span className="mono">Top {SHOWN} of Qloo&rsquo;s 10</span>
          </p>
          <RerankList
            rows={rows.slice(0, SHOWN)}
            listRef={ref}
            label={
              signal === null
                ? `Top ${SHOWN} with no taste signal`
                : `Top ${SHOWN} for a fan of ${snapshot.signals[signal].name}, with movement against the plain search`
            }
          />
        </div>
      </div>
    </section>
  );
}
