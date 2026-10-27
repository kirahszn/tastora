"use client";
// One ranked place. Every statement about the restaurant comes from the facts object
// (Qloo data, the profile or feedback); this component only lays it out.
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { SCORE_LABELS, placeLine, priceLabel, ratingLabel, signed } from "@/lib/ui/format";
import { safeHttpUrl, telHref } from "@/lib/ui/links";
import { requirementLabel, splitSource } from "@/lib/ui/status";
import type { Verdict } from "@/lib/ui/storage";
import type { RecommendResult } from "@/lib/ui/types";
import styles from "./results.module.css";

const VERDICT_BUTTONS: { verdict: Verdict; label: string }[] = [
  { verdict: "liked", label: "Like" },
  { verdict: "disliked", label: "Not for them" },
  { verdict: "notSuitable", label: "Not suitable" },
  { verdict: "tried", label: "Already tried" },
];

const VERDICT_NOTE: Record<Verdict, string> = {
  liked: "Places with the same cuisine may rank higher next time.",
  disliked: "It will rank lower next time.",
  notSuitable: "It won't be shown next time.",
  tried: "It will rank a little lower next time.",
};

const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;

export function ResultCard({
  result: r,
  verdict,
  onVerdict,
  shortlisted,
  onToggleShortlist,
}: {
  result: RecommendResult;
  verdict: Verdict | null;
  onVerdict: (v: Verdict | null) => void;
  shortlisted: boolean;
  onToggleShortlist: () => void;
}) {
  const headingId = `place-${r.rank}`;
  const price = priceLabel(r.venue.priceLevel);
  const rating = ratingLabel(r.venue.rating);
  const website = safeHttpUrl(r.links.website);
  const maps = safeHttpUrl(r.links.mapsUrl);
  const tel = telHref(r.links.phone);
  const where = placeLine(r);
  const conflicts = r.constraintStatuses.filter((s) => s.status === "conflict");

  return (
    <article className={styles.card} aria-labelledby={headingId}>
      <header className={styles.cardHeader}>
        <span className={styles.rank} aria-hidden="true">
          {r.rank}
        </span>
        <div>
          <h3 id={headingId} className={styles.cardTitle}>
            <span className="sr-only">Suggestion {r.rank}: </span>
            {r.name}
          </h3>
          {where && (
            <p className={`${styles.where} ${r.area.kind === "outside_nyc" ? styles.outside : ""}`}>{where}</p>
          )}
          <p className={styles.meta}>
            {r.venue.cuisines.length > 0 && <span>{r.venue.cuisines.slice(0, 3).join(", ")}</span>}
            {price && (
              <span>
                <span aria-hidden="true">{price.symbols}</span>
                <span className="sr-only">{price.text}</span>
              </span>
            )}
            {rating && (
              <span>
                <span aria-hidden="true">{rating.short}</span>
                <span className="sr-only">{rating.text}</span>
              </span>
            )}
          </p>
        </div>
      </header>

      <button
        type="button"
        className={styles.shortlistToggle}
        aria-pressed={shortlisted}
        onClick={onToggleShortlist}
      >
        <Icon name={shortlisted ? "check" : "plus"} />
        {shortlisted ? "On your shortlist" : "Add to shortlist"}
        <span className="sr-only">: {r.name}</span>
      </button>

      {(r.warnings.length > 0 || conflicts.length > 0) && (
        <div className={styles.cardWarning} role="note" aria-label="Warnings">
          <Icon name="alert" />
          <ul>
            {r.warnings.map((w) => (
              <li key={w.text}>
                <strong>{w.text}.</strong> Ask carefully before choosing this place.
              </li>
            ))}
            {conflicts.map((c) => (
              <li key={c.requirement}>
                <strong>Conflict: {requirementLabel(c.requirement)}.</strong> Qloo&rsquo;s tags contradict this need.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.cardBody}>
        <div>
          <h4>Why it was suggested</h4>
          <ul className={styles.reasons}>
            {r.reasons.slice(0, 3).map((reason) => (
              <li key={reason.text}>
                {reason.text}
                {reason.strength === "related" && <span className={styles.tag}>related</span>}
              </li>
            ))}
          </ul>
        </div>

        {r.constraintStatuses.length > 0 && (
          <div>
            <h4>Their needs</h4>
            <ul className={styles.badges}>
              {r.constraintStatuses.map((s) => (
                <li key={s.requirement}>
                  <StatusBadge requirement={s} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h4>Dishes to ask about</h4>
          {r.dishesToAskAbout.length > 0 ? (
            <ul className={styles.dishes}>
              {r.dishesToAskAbout.map((d) => (
                <li key={d.name}>
                  {d.name}
                  {d.note && <span className={styles.softNote}>{d.note}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Qloo lists no dishes we could suggest here.</p>
          )}
          {r.removedDishes.length > 0 && (
            <p className={styles.removedLine}>
              {r.removedDishes.length === 1 ? "1 listed dish was" : `${r.removedDishes.length} listed dishes were`}{" "}
              set aside for their needs. See details.
            </p>
          )}
        </div>

        {r.needsConfirmation.length > 0 && (
          <div className={styles.ask}>
            <h4>Ask the restaurant</h4>
            <ul>
              {r.needsConfirmation.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {(website || tel || maps) && (
          <div className={styles.links}>
            {website && (
              <a className="btn btn-secondary" href={website} target="_blank" rel="noopener noreferrer">
                <Icon name="external" /> Website{NEW_TAB}
              </a>
            )}
            {tel && (
              <a className="btn btn-secondary" href={tel}>
                <Icon name="phone" /> Call<span className="sr-only"> {r.name}</span>
              </a>
            )}
            {maps && (
              <a className="btn btn-secondary" href={maps} target="_blank" rel="noopener noreferrer">
                <Icon name="map" /> Open in Google Maps{NEW_TAB}
              </a>
            )}
          </div>
        )}
      </div>

      <details className={styles.details}>
        <summary>
          Show details<span className="sr-only"> for {r.name}</span>
        </summary>
        <div className={styles.detailsBody}>
          <section>
            <h4>All reasons and their sources</h4>
            <ul className={styles.sourced}>
              {r.reasons.map((reason) => (
                <li key={reason.text}>
                  {reason.text}
                  <span className={styles.source}>Source: {reason.source}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4>Needs, in detail</h4>
            {r.constraintStatuses.length === 0 ? (
              <p className={styles.muted}>No allergies, diet, texture or comfort needs were set.</p>
            ) : (
              <ul className={styles.sourced}>
                {r.constraintStatuses.map((s) => (
                  <li key={s.requirement}>
                    <StatusBadge requirement={s} />
                    {[...s.evidence.slice(1), ...s.warnings].map((line) => {
                      const { source, text } = splitSource(line);
                      return (
                        <span key={line} className={styles.source}>
                          {text}
                          {source && ` (${source})`}
                        </span>
                      );
                    })}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4>Dishes set aside</h4>
            {r.removedDishes.length === 0 ? (
              <p className={styles.muted}>None.</p>
            ) : (
              <ul className={styles.sourced}>
                {r.removedDishes.map((d) => (
                  <li key={`${d.name}-${d.requirement}`}>
                    <strong>{d.name}</strong>: {d.why}
                    <span className={styles.source}>
                      Because of: {d.reason} &ldquo;{d.requirement}&rdquo; · Source: {d.source}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {r.area.label && (
            <section>
              <h4>Location</h4>
              <p>
                {r.area.label}
                {r.area.source && <span className={styles.source}>Source: {r.area.source}</span>}
              </p>
            </section>
          )}

          <section>
            <h4>Score breakdown</h4>
            <table className={styles.scoreTable}>
              <caption className="sr-only">How {r.name}&rsquo;s score adds up</caption>
              <tbody>
                {(Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).map((k) => (
                  <tr key={k} className={r.scoreBreakdown[k] === 0 ? styles.zero : undefined}>
                    <th scope="row">{SCORE_LABELS[k]}</th>
                    <td>{signed(r.scoreBreakdown[k] ?? 0)}</td>
                  </tr>
                ))}
                <tr className={styles.totalRow}>
                  <th scope="row">Total</th>
                  <td>{r.scoreBreakdown.total}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </details>

      <div className={styles.feedback} role="group" aria-label={`Your feedback on ${r.name}`}>
        <p className={styles.feedbackLabel}>Your feedback</p>
        <div className={styles.feedbackButtons}>
          {VERDICT_BUTTONS.map((b) => (
            <button
              key={b.verdict}
              type="button"
              className={styles.feedbackButton}
              aria-pressed={verdict === b.verdict}
              onClick={() => onVerdict(verdict === b.verdict ? null : b.verdict)}
            >
              {verdict === b.verdict && (
                <span aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
              )}
              {b.label}
            </button>
          ))}
        </div>
        {verdict && <p className={styles.feedbackNote}>Saved. {VERDICT_NOTE[verdict]}</p>}
      </div>
    </article>
  );
}
