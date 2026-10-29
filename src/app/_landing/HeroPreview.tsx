"use client";
// The hero's phone (Phase 12): Tastora in three states, drawn in HTML from stored real data.
//  1. Their tastes: the app's own Sinatra example profile (profileDraft.ts).
//  2. Qloo's match: Qloo's top 4 for that profile without and with the Frank Sinatra signal, from
//     the live Phase 3 smoke run (heroSnapshot.match, copied from docs/phase3-smoke.md); movement
//     from the app's rankMovement over the full top 10s.
//  3. The check: the Lenny's Clam Bar result from a live search (heroSnapshot.result), with Qloo's
//     own image of the place.
// Steps advance every 3.5s, pause on hover or focus and with the Pause button; reduced motion shows
// the check, still, with the steps tappable.
import { useEffect, useRef, useState } from "react";
import { ChefMark } from "@/components/ChefMark";
import { CuisineArt } from "@/components/CuisineArt";
import { Icon } from "@/components/Icon";
import { PlaceMedia } from "@/components/PlaceMedia";
import { MovementBadge } from "@/components/RerankList";
import { SafetyZones } from "@/components/SafetyZones";
import { useFlip } from "@/components/useFlip";
import { useReducedMotion } from "@/components/useReducedMotion";
import { placeLine } from "@/lib/ui/format";
import { exampleById } from "@/lib/ui/profileDraft";
import { evidenceSentence, rankMovement } from "@/lib/ui/rankMovement";
import { topReason } from "@/lib/ui/share";
import type { RecommendResult } from "@/lib/ui/types";
import snapshot from "./heroSnapshot.json";
import styles from "./landing.module.css";

const STEPS = ["Their tastes", "Qloo’s match", "The check"] as const;
const ADVANCE_MS = 3500;
const SHOWN = 4;

const result = snapshot.result as unknown as RecommendResult;
const sinatra = exampleById("sinatra").draft;
const refs = (names: string[]) => names.map((name) => ({ id: name, name }));
const moves = rankMovement(refs(snapshot.match.baseline), refs(snapshot.match.personalised));
const matchSentence = evidenceSentence({
  signalsUsed: [{ id: snapshot.match.signal, name: snapshot.match.signal, kind: "artist" }],
  personalisedTop10: refs(snapshot.match.personalised),
  overlapCount: snapshot.match.personalised.filter((n) => snapshot.match.baseline.includes(n)).length,
  rankChanges: snapshot.match.personalised.filter((n, i) => snapshot.match.baseline[i] !== n).length,
});

function TastesScreen() {
  const groups: { label: string; items: string[]; avoid?: boolean }[] = [
    { label: "Loves", items: [...sinatra.favouriteCuisines, ...sinatra.favouriteDishes] },
    { label: "Music", items: sinatra.music },
    { label: "Must avoid", items: sinatra.dietaryRestrictions, avoid: true },
    { label: "Needs", items: sinatra.wheelchairAccess ? ["wheelchair access"] : [] },
  ];
  return (
    <div className={styles.screenBody}>
      <p className={styles.screenTitle}>
        <span className={styles.avatar} aria-hidden="true">
          <Icon name="heart" size={16} />
        </span>
        For {sinatra.displayName}
      </p>
      {groups.map((g, gi) => (
        <div key={g.label} className={`${styles.tasteGroup} ${g.avoid ? styles.tasteAvoid : ""}`}>
          <p className={styles.screenLabel}>{g.label}</p>
          <ul className={styles.tasteChips}>
            {g.items.map((item, i) => (
              <li key={item} className={styles.tasteChip} style={{ animationDelay: `${(gi * 2 + i) * 90}ms` }}>
                {g.avoid && <Icon name="ban" size={14} />}
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className={styles.screenWhere}>
        <Icon name="map" size={15} /> {sinatra.area}, {sinatra.city}
      </p>
      <span className={`btn btn-primary ${styles.screenButton}`} aria-hidden="true">
        Find restaurants <Icon name="arrow" size={16} />
      </span>
    </div>
  );
}

function MatchScreen({ reduced }: { reduced: boolean }) {
  const [moved, setMoved] = useState(false);
  const { ref, capture } = useFlip<HTMLOListElement>({ duration: 700, stagger: 60 });
  const personal = reduced || moved;

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => {
      capture();
      setMoved(true);
    }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit to this step
  }, []);

  const names = (personal ? snapshot.match.personalised : snapshot.match.baseline).slice(0, SHOWN);
  return (
    <div className={styles.screenBody}>
      <p className={styles.screenLabel}>Italian American near Queens</p>
      <p className={styles.matchHead}>
        {personal ? (
          <>
            <span className={styles.qlooBadge}>Qloo</span> For a fan of {snapshot.match.signal}
          </>
        ) : (
          "Without their tastes"
        )}
      </p>
      <ol ref={ref} className={styles.matchList}>
        {names.map((name, i) => (
          <li
            key={name}
            data-flip={name}
            className={`${styles.matchRow} ${name === result.name ? styles.matchPick : ""}`}
          >
            <span className={styles.matchRank}>{i + 1}</span>
            <CuisineArt kind="italian" size={30} />
            <span className={styles.matchName}>{name}</span>
            {personal && <MovementBadge m={moves[i].movement} />}
          </li>
        ))}
      </ol>
      {personal && matchSentence && (
        <p className={styles.matchSentence}>
          <Icon name="sparkle" size={16} />
          <span>
            {matchSentence} <span className="tone-muted">Same city, same cuisine; only the taste changed.</span>
          </span>
        </p>
      )}
    </div>
  );
}

function CheckScreen() {
  return (
    <div className={styles.screenBody}>
      <PlaceMedia
        imageUrl={snapshot.image.url}
        alt={snapshot.image.alt}
        cuisines={result.venue.cuisines}
        className={styles.checkMedia}
      >
        <span className={styles.checkRank}>{result.rank}</span>
      </PlaceMedia>
      <div>
        <p className={styles.checkName}>{result.name}</p>
        <p className={styles.checkWhere}>{placeLine(result)}</p>
      </div>
      <p className={styles.checkWhy}>
        <span className={styles.qlooBadge}>Qloo</span>
        {topReason(result)}
      </p>
      <SafetyZones
        statuses={result.constraintStatuses}
        questions={result.needsConfirmation}
        call={{ name: result.name }}
        heading="p"
        compact
      />
    </div>
  );
}

export function HeroPreview() {
  const [cycled, setCycled] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const figure = useRef<HTMLElement>(null);
  // Reduced motion: the check, still, until a step is tapped. The server renders "Their tastes".
  const reduced = useReducedMotion();
  const step = chosen ?? (reduced ? 2 : cycled);

  // No point cycling while the hero is scrolled away.
  useEffect(() => {
    const el = figure.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Tapping a step stops the cycle; Play resumes it from that step.
  const running = !reduced && chosen === null && !paused && !held && onScreen;
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setCycled((s) => (s + 1) % STEPS.length), ADVANCE_MS);
    return () => window.clearTimeout(t);
  }, [running, cycled]);

  const choose = (i: number) => {
    setChosen(i);
    setPaused(true);
  };

  const togglePlay = () => {
    if (paused && chosen !== null) {
      setCycled(chosen);
      setChosen(null);
    }
    setPaused(!paused);
  };

  return (
    <figure
      ref={figure}
      className={styles.heroFigure}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
      }}
    >
      <div className={styles.phone} role="group" aria-roledescription="preview" aria-label={`Tastora preview: ${STEPS[step]}`}>
        <div className={styles.screen}>
          <div className={styles.appBar} aria-hidden="true">
            <ChefMark size={22} />
            <span className={styles.appName}>Tastora</span>
            <span className={styles.appStep}>
              {step + 1}/{STEPS.length}
            </span>
          </div>
          <div key={step} className={styles.screenState}>
            {step === 0 && <TastesScreen />}
            {step === 1 && <MatchScreen reduced={reduced} />}
            {step === 2 && <CheckScreen />}
          </div>
        </div>
      </div>

      <div className={styles.previewSteps}>
        <ol className={styles.stepButtons} aria-label="Preview steps">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                className={styles.stepButton}
                aria-current={i === step ? "step" : undefined}
                onClick={() => choose(i)}
              >
                <span className={styles.stepNumber}>{i + 1}</span>
                {label}
                {i === step && running && <span key={step} className={styles.stepProgress} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ol>
        {!reduced && (
          <button
            type="button"
            className={styles.pauseButton}
            onClick={togglePlay}
            aria-label={paused ? "Play the preview" : "Pause the preview"}
          >
            <Icon name={paused ? "play" : "pause"} size={16} />
          </button>
        )}
      </div>
      <figcaption className="mono">
        Real data: Tastora&rsquo;s Sinatra example and live searches for it, October 2026. Image: Qloo.
      </figcaption>
    </figure>
  );
}
