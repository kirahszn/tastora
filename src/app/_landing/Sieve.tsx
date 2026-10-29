"use client";
// "The check" (step 3 of See it work): the dishes Qloo lists for a real restaurant settle into two
// trays, "Ask about" and "Set aside", with the engine's own reason. The data comes from sieveData.ts
// (the app's Phase 2 code run on a committed Qloo sample at build time). With motion, the dishes
// start as Qloo lists them and sort themselves when the step opens, on each place and on "Replay";
// reduced motion shows the sorted trays straight away.
import { useEffect, useRef, useState } from "react";
import { CuisineArt } from "@/components/CuisineArt";
import { Icon } from "@/components/Icon";
import { SafetyZones } from "@/components/SafetyZones";
import { useFlip } from "@/components/useFlip";
import { useReducedMotion } from "@/components/useReducedMotion";
import type { SievePlace } from "./sieveData";
import styles from "./landing.module.css";

type Phase = "listed" | "sorted";
const SORT_DELAY_MS = 700;

export function Sieve({ places }: { places: SievePlace[] }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(reduced ? "sorted" : "listed");
  const { ref, capture } = useFlip<HTMLDivElement>({ duration: 750, stagger: 45 });
  const timer = useRef<number | undefined>(undefined);
  const p = places[index];

  const sortSoon = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      capture();
      setPhase("sorted");
    }, SORT_DELAY_MS);
  };

  const run = (next: number) => {
    setIndex(next);
    if (reduced) return setPhase("sorted");
    setPhase("listed");
    sortSoon();
  };

  // The step just opened: show Qloo's list, then sort it.
  useEffect(() => {
    if (!reduced) sortSoon();
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const sorted = phase === "sorted";

  return (
    <div className={styles.sieve}>
      <div className={styles.sieveIntro}>
        <p className={styles.demoLead}>
          Another real search: Nigerian food in Brooklyn for someone with a peanut allergy who needs soft food.
        </p>
        <SafetyZones statuses={p.statuses} heading="p" compact />
      </div>

      <div className={styles.chips} role="group" aria-label="Restaurant">
        {places.map((pl, i) => (
          <button key={pl.name} type="button" className="chip" aria-pressed={i === index} onClick={() => run(i)}>
            <CuisineArt kind="westAfrican" size={26} />
            {pl.name}
          </button>
        ))}
      </div>

      <div className={`card ${styles.sieveCard}`} ref={ref}>
        <div className={styles.sieveTop}>
          <p className={styles.sieveName}>{p.name}</p>
          <p className="mono">
            {p.area ? `${p.area} · ` : ""}
            {p.listed.length} dishes listed by Qloo
          </p>
        </div>

        {p.warnings.map((w) => (
          <p key={w} className={styles.sieveWarning}>
            <Icon name="alert" /> {w}.
          </p>
        ))}

        {sorted ? (
          <div className={styles.trays}>
            <div className={`${styles.tray} ${styles.trayAsk}`}>
              <h3 className={styles.trayLabel}>
                <Icon name="question" size={16} /> Ask about <span className="mono">{p.kept.length}</span>
              </h3>
              {p.kept.length ? (
                <ul className={styles.dishList}>
                  {p.kept.map((d) => (
                    <li key={d.name} data-flip={d.name} className={styles.dish}>
                      {d.name}
                      {d.note && <span className={styles.dishNote}>{d.note}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.sieveEmpty}>None. Ask what they can make instead.</p>
              )}
            </div>
            <div className={`${styles.tray} ${styles.trayAside}`}>
              <h3 className={styles.trayLabel}>
                <Icon name="ban" size={16} /> Set aside <span className="mono">{p.setAside.length}</span>
              </h3>
              <ul className={styles.dishList}>
                {p.setAside.map((d) => (
                  <li key={d.name} data-flip={d.name} className={`${styles.dish} ${styles.dishAside}`}>
                    <span className={styles.dishStruck}>{d.name}</span>
                    <span className={styles.dishWhy}>{d.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className={styles.tray}>
            <h3 className={styles.trayLabel}>Listed by Qloo</h3>
            <ul className={styles.dishList}>
              {p.listed.map((name) => (
                <li key={name} data-flip={name} className={styles.dish}>
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {sorted
            ? `${p.name}: ${p.kept.length} dishes to ask about, ${p.setAside.length} set aside.`
            : `Checking ${p.listed.length} dishes listed for ${p.name}.`}
        </p>
      </div>

      <div className={styles.sieveFoot}>
        <button type="button" className="btn btn-quiet" onClick={() => run(index)}>
          <Icon name="arrow" /> Replay
        </button>
        <p className="mono">
          Checked by Tastora&rsquo;s own code on a stored Qloo search (West African restaurants, New York City, October
          2026). The allergy itself always needs confirming with the restaurant.
        </p>
      </div>
    </div>
  );
}
