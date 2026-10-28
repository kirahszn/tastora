"use client";
// "Call the restaurant" checklist for the shortlist, for print or PDF. It reads the cached results
// and shortlist from this browser session and lays out only facts from `results[]`.
import Link from "next/link";
import { useHydrated } from "@/components/useHydrated";
import { placeLine } from "@/lib/ui/format";
import { formatPhone, telHref } from "@/lib/ui/links";
import { SHARE_DISCLAIMER, SITE_URL, shortlistedResults } from "@/lib/ui/share";
import { requirementLabel } from "@/lib/ui/status";
import { loadLastSearch, loadProfile, loadShortlist } from "@/lib/ui/storage";
import type { RecommendResult } from "@/lib/ui/types";
import styles from "./print.module.css";

function loadPlaces(): RecommendResult[] {
  const profile = loadProfile();
  const response = profile && loadLastSearch(profile);
  if (!response) return [];
  return shortlistedResults(response.results, loadShortlist(response.results) ?? []);
}

export function PrintView() {
  const hydrated = useHydrated();
  if (!hydrated) return <p>Loading…</p>;
  const places = loadPlaces();

  if (!places.length) {
    return (
      <div className={styles.empty}>
        <h1>Nothing to print yet</h1>
        <p>
          The checklist uses the places on your shortlist from this browser session. Find restaurants, choose
          &ldquo;Add to shortlist&rdquo; on the ones you like, then come back here.
        </p>
        <Link href="/results" className="btn btn-primary">
          Back to suggestions
        </Link>
      </div>
    );
  }

  const date = new Date().toLocaleDateString(undefined, { dateStyle: "long" });

  return (
    <div className={styles.sheet}>
      <div className={`${styles.toolbar} ${styles.noPrint}`}>
        <Link href="/results" className="btn btn-secondary">
          Back to suggestions
        </Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <header className={styles.head}>
        <h1>Before you go — questions to ask</h1>
        <p className={styles.date}>{date}</p>
        <p>
          {places.length} place{places.length === 1 ? "" : "s"} from your Tastora shortlist. Tick each question once the
          restaurant has answered it.
        </p>
      </header>

      {places.map((r, i) => {
        const where = placeLine(r);
        const conflicts = r.constraintStatuses.filter((s) => s.status === "conflict");
        const phone = r.links.phone && telHref(r.links.phone) ? formatPhone(r.links.phone) : null;
        return (
          <article key={r.candidateId} className={styles.place} aria-labelledby={`p-${r.candidateId}`}>
            <h2 id={`p-${r.candidateId}`}>
              {i + 1}. {r.name}
            </h2>
            {r.venue.address && <p>{r.venue.address}</p>}
            {where && <p className={styles.where}>{where}</p>}
            <p className={styles.phone}>{phone ? `Phone: ${phone}` : "No phone number listed"}</p>

            {(r.warnings.length > 0 || conflicts.length > 0) && (
              <ul className={styles.warnings} aria-label="Warnings">
                {r.warnings.map((w) => (
                  <li key={w.text}>
                    <strong>Warning:</strong> {w.text}. Ask carefully before choosing this place.
                  </li>
                ))}
                {conflicts.map((c) => (
                  <li key={c.requirement}>
                    <strong>Conflict: {requirementLabel(c.requirement)}.</strong> Qloo&rsquo;s tags contradict this need.
                  </li>
                ))}
              </ul>
            )}

            <h3>Dishes to ask about</h3>
            {r.dishesToAskAbout.length > 0 ? (
              <p className={styles.dishes}>
                {r.dishesToAskAbout.map((d) => (d.note ? `${d.name} (${d.note})` : d.name)).join(" · ")}
              </p>
            ) : (
              <p>Qloo lists no dishes we could suggest here.</p>
            )}

            <h3>Questions to ask</h3>
            <ul className={styles.checklist}>
              {r.needsConfirmation.map((q) => (
                <li key={q}>
                  <span className={styles.box} aria-hidden="true">
                    ☐
                  </span>
                  <span>
                    {q}
                    <span className={styles.noteLine} aria-hidden="true" />
                  </span>
                </li>
              ))}
              <li>
                <span className={styles.box} aria-hidden="true">
                  ☐
                </span>
                <span>
                  Other notes
                  <span className={styles.noteLine} aria-hidden="true" />
                  <span className={styles.noteLine} aria-hidden="true" />
                </span>
              </li>
            </ul>
          </article>
        );
      })}

      <footer className={styles.disclaimer}>
        <p>
          <strong>{SHARE_DISCLAIMER}</strong>
        </p>
        <p>{SITE_URL}</p>
      </footer>
    </div>
  );
}
