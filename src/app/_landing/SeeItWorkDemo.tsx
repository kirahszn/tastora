"use client";
// "See it work" (Phase 12): the re-rank and the safety check as one guided demo in three tappable
// steps, on real data only.
//  1. Tastes: pick a favourite singer (or none) for an Italian food lover in New York City.
//  2. Qloo's match: rerankSnapshot.json, built by scripts/landing-rerank.ts from stored Qloo
//     responses (Phase 1 probe, 2026-10-26; Bob Marley and a repeat of the plain search captured
//     2026-10-28, which returned the identical top 10). Same request each time; only the signal
//     differs. Rows glide from the plain ranking; movement and the sentence come from rankMovement /
//     evidenceSentence.
//  3. The check: Sieve.tsx with sieveData.ts (the app's Phase 2 engine on a committed sample).
import { useEffect, useState } from "react";
import { CuisineArt } from "@/components/CuisineArt";
import { Icon } from "@/components/Icon";
import { RerankList, type RerankRow } from "@/components/RerankList";
import { useFlip } from "@/components/useFlip";
import { useReducedMotion } from "@/components/useReducedMotion";
import { droppedOut, evidenceSentence, rankMovement } from "@/lib/ui/rankMovement";
import snapshot from "./rerankSnapshot.json";
import { Sieve } from "./Sieve";
import type { SievePlace } from "./sieveData";
import styles from "./landing.module.css";

const STEPS = [
  { title: "Tastes", sub: "A favourite singer" },
  { title: "Qloo’s match", sub: "Re-ranked by taste" },
  { title: "The check", sub: "Every dish, every need" },
] as const;

const baseline = snapshot.baseline.top10;
/** Rows shown; movement and the sentence still compare the full top 10s. */
const SHOWN = 6;

function view(signal: number | null) {
  if (signal === null) return { rows: baseline as RerankRow[], sentence: "", left: 0 };
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

const who = (signal: number | null) => (signal === null ? "No taste signal" : `Fan of ${snapshot.signals[signal].name}`);

function SingerChips({ signal, onPick }: { signal: number | null; onPick: (s: number | null) => void }) {
  return (
    <div className={styles.chips} role="group" aria-label="Favourite singer">
      {snapshot.signals.map((s, i) => (
        <button key={s.name} type="button" className="chip" aria-pressed={signal === i} onClick={() => onPick(i)}>
          <Icon name="sparkle" size={16} />
          {s.name}
        </button>
      ))}
      <button type="button" className="chip" aria-pressed={signal === null} onClick={() => onPick(null)}>
        No favourite singer
      </button>
    </div>
  );
}

function TastesStep({ signal, onPick, onNext }: { signal: number | null; onPick: (s: number | null) => void; onNext: () => void }) {
  return (
    <div className={styles.demoSplit}>
      <div className={styles.stack}>
        <p className={styles.demoLead}>Tell Tastora what they love. Here: a favourite singer.</p>
        <SingerChips signal={signal} onPick={onPick} />
        <button type="button" className={`btn btn-primary ${styles.demoNext}`} onClick={onNext}>
          See Qloo&rsquo;s match <Icon name="arrow" size={18} />
        </button>
      </div>
      <div className={styles.tasteCard} aria-label="Their tastes">
        <p className={styles.screenLabel}>Their tastes</p>
        <ul className={styles.tasteChips}>
          <li className={styles.tasteChip}>{snapshot.cuisine}</li>
          <li className={styles.tasteChip}>{snapshot.city}</li>
        </ul>
        <p key={signal ?? "none"} className={styles.tasteSignal}>
          <span className={styles.avatar} aria-hidden="true">
            <Icon name="heart" size={16} />
          </span>
          {signal === null ? "No taste signal" : snapshot.signals[signal].name}
        </p>
        <p className="mono">Qloo turns this into a taste signal for its restaurant ranking.</p>
      </div>
    </div>
  );
}

function MatchStep({ signal, onPick, onNext }: { signal: number | null; onPick: (s: number | null) => void; onNext: () => void }) {
  const reduced = useReducedMotion();
  // Arrive on the plain ranking, then glide into this person's ranking.
  const [shown, setShown] = useState<number | null>(reduced ? signal : null);
  const { ref, capture } = useFlip<HTMLOListElement>();

  useEffect(() => {
    if (reduced || signal === null) return;
    const t = window.setTimeout(() => {
      capture();
      setShown(signal);
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit to this step
  }, []);

  const pick = (next: number | null) => {
    if (next === shown) return;
    capture();
    setShown(next);
    onPick(next);
  };

  const { rows, sentence, left } = view(shown);
  return (
    <div className={styles.demoSplit}>
      <div className={styles.stack}>
        <p className={styles.demoLead}>
          Qloo ranks {snapshot.cuisine} restaurants in {snapshot.city} for this person&rsquo;s taste.
        </p>
        <SingerChips signal={shown} onPick={pick} />
        <p className={styles.liveSentence} aria-live="polite">
          {sentence}
          {left > 0 && <span className="tone-muted"> {left === 1 ? "1 place" : `${left} places`} left the top 10.</span>}
        </p>
        <button type="button" className={`btn btn-primary ${styles.demoNext}`} onClick={onNext}>
          See the check <Icon name="arrow" size={18} />
        </button>
      </div>
      <div className={`card ${styles.rerankCard}`}>
        <p className={styles.rerankHead}>
          <span>
            <span className={styles.qlooBadge}>Qloo</span> {who(shown)}
          </span>
          <span className="mono">Top {SHOWN} of 10</span>
        </p>
        <RerankList
          rows={rows.slice(0, SHOWN)}
          listRef={ref}
          leading={<CuisineArt kind="italian" size={36} />}
          label={
            shown === null
              ? `Top ${SHOWN} with no taste signal`
              : `Top ${SHOWN} for a fan of ${snapshot.signals[shown].name}, with movement against the plain search`
          }
        />
      </div>
    </div>
  );
}

export function SeeItWorkDemo({ places }: { places: SievePlace[] }) {
  const [step, setStep] = useState(0);
  const [signal, setSignal] = useState<number | null>(0);

  return (
    <div className={styles.demo}>
      <ol className={styles.demoSteps} aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              className={styles.demoStep}
              aria-current={i === step ? "step" : undefined}
              onClick={() => setStep(i)}
            >
              <span className={styles.demoStepNum}>{i + 1}</span>
              <span className={styles.demoStepText}>
                <span className={styles.demoStepTitle}>{s.title}</span>
                <span className={styles.demoStepSub}>{s.sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div key={step} className={styles.demoStage}>
        {step === 0 && <TastesStep signal={signal} onPick={setSignal} onNext={() => setStep(1)} />}
        {step === 1 && <MatchStep signal={signal} onPick={setSignal} onNext={() => setStep(2)} />}
        {step === 2 && <Sieve places={places} />}
      </div>

      {step < 2 && (
        <p className="mono">
          Real Qloo results from test searches, October 2026. Same request each time; only the taste signal changes.
        </p>
      )}
    </div>
  );
}
