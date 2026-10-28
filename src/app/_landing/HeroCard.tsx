// The hero's result card, drawn in HTML from heroSnapshot.json: one real result (Lenny's Clam Bar)
// from a live Tastora search for the Sinatra example profile on 2026-10-27. It uses the same
// helpers as the results page (placeLine, topReason, StatusBadge) and adds nothing to the facts.
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { placeLine } from "@/lib/ui/format";
import { topReason } from "@/lib/ui/share";
import type { RecommendResult } from "@/lib/ui/types";
import snapshot from "./heroSnapshot.json";
import styles from "./landing.module.css";

const VISIBLE_DISHES = 5;

export function HeroCard() {
  const r = snapshot.result as unknown as RecommendResult;
  const dishes = r.dishesToAskAbout.slice(0, VISIBLE_DISHES);
  const more = r.dishesToAskAbout.length - dishes.length;

  return (
    <figure className={styles.heroFigure}>
      <article className={`card ${styles.heroCard}`} aria-label={`Example result: ${r.name}`}>
        <p className={styles.heroCardTop}>
          {/* That search returned 8 suggestions; this was the first. */}
          <span className="mono">Suggestion {r.rank} of 8</span>
          <span className={styles.heroFor}>For Dad · Italian-American · Frank Sinatra</span>
        </p>
        <h2 className={styles.heroCardName}>{r.name}</h2>
        <p className={styles.heroCardWhere}>{placeLine(r)}</p>
        <p className={styles.heroCardWhy}>
          <Icon name="sparkle" size={18} />
          {topReason(r)}
        </p>
        <ul className={styles.heroBadges} aria-label="Their needs">
          {r.constraintStatuses.map((s) => (
            <li key={s.requirement}>
              <StatusBadge requirement={s} />
            </li>
          ))}
        </ul>
        <div className={styles.heroBlock}>
          <h3 className={styles.heroLabel}>Dishes to ask about</h3>
          <p className={styles.heroDishes}>
            {dishes.map((d) => d.name).join(" · ")}
            {more > 0 && <span className={styles.heroMore}> +{more} more</span>}
          </p>
        </div>
        <div className={styles.heroAsk}>
          <h3 className={styles.heroLabel}>Ask the restaurant</h3>
          <ul>
            {r.needsConfirmation.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      </article>
      <figcaption className="mono">
        A real result from a Tastora search, 27 October 2026: Qloo&rsquo;s taste data, checked by Tastora&rsquo;s code.
      </figcaption>
    </figure>
  );
}
