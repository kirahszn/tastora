"use client";
// "The safety check": the dishes Qloo lists for a real restaurant settle into "Dishes to ask about"
// and "Set aside", with the engine's own reason. The data comes from sieveData.ts (the app's Phase 2
// code run on a committed Qloo sample at build time). Server render, no JavaScript and reduced
// motion all show the sorted result; with motion, the list starts unsorted and sorts itself when it
// scrolls into view, and again on each place or "Replay".
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { prefersReducedMotion, useFlip } from "@/components/useFlip";
import type { SievePlace } from "./sieveData";
import styles from "./landing.module.css";

type Phase = "listed" | "sorted";
const SORT_DELAY_MS = 500;

export function Sieve({ places }: { places: SievePlace[] }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("sorted");
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
    if (prefersReducedMotion()) return setPhase("sorted");
    setPhase("listed");
    sortSoon();
  };

  // First time the section scrolls into view: show Qloo's list, then sort it.
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !("IntersectionObserver" in window)) return;
    // Already on screen (reload mid-page): leave the sorted result alone.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setPhase("listed");
        sortSoon();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const sorted = phase === "sorted";

  return (
    <div className={styles.sieve}>
      <div className={styles.chips} role="group" aria-label="Restaurant">
        {places.map((pl, i) => (
          <button key={pl.name} type="button" className="chip" aria-pressed={i === index} onClick={() => run(i)}>
            {pl.name}
          </button>
        ))}
      </div>

      <div className={`card ${styles.sieveCard}`} ref={ref}>
        <div className={styles.sieveTop}>
          <div>
            <p className={styles.sieveName}>{p.name}</p>
            <p className="mono">
              {p.area ? `${p.area} · ` : ""}
              {p.listed.length} dishes listed by Qloo
            </p>
          </div>
          <ul className={styles.sieveBadges} aria-label="Their needs">
            {p.statuses.map((s) => (
              <li key={s.requirement}>
                <StatusBadge requirement={s} />
              </li>
            ))}
          </ul>
        </div>

        {p.warnings.map((w) => (
          <p key={w} className={styles.sieveWarning}>
            <Icon name="alert" /> {w}.
          </p>
        ))}

        {sorted ? (
          <div className={styles.sieveCols}>
            <div>
              <h3 className={styles.sieveLabel}>
                Dishes to ask about <span className="mono">{p.kept.length}</span>
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
            <div className={styles.asideCol}>
              <h3 className={styles.sieveLabel}>
                Set aside <span className="mono">{p.setAside.length}</span>
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
          <div>
            <h3 className={styles.sieveLabel}>Listed by Qloo</h3>
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
          Checked by Tastora&rsquo;s own code on a stored Qloo search (New York City, October 2026) for a Nigerian food
          lover in Brooklyn with a peanut allergy who needs soft food.
        </p>
      </div>
    </div>
  );
}
