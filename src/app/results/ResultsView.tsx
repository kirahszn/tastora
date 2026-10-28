"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useHydrated } from "@/components/useHydrated";
import type { SeniorProfile } from "@/lib/domain/profile";
import { toolLabel } from "@/lib/ui/format";
import { ERROR_COPY, SearchError, requestBody, runSearch, type SearchErrorKind } from "@/lib/ui/searchClient";
import { splitSource } from "@/lib/ui/status";
import {
  clearShortlist,
  defaultShortlist,
  feedbackCount,
  initialShortlist,
  loadFeedback,
  loadLastSearch,
  loadProfile,
  saveFeedback,
  saveLastSearch,
  saveShortlist,
  setVerdict,
  toggleShortlist,
  toRankingFeedback,
  type FeedbackStore,
  type Verdict,
} from "@/lib/ui/storage";
import type { RecommendResponse, TraceStep } from "@/lib/ui/types";
import { EvidencePanel } from "./EvidencePanel";
import { ResultCard } from "./ResultCard";
import { SearchProgress } from "./SearchProgress";
import { ShortlistBar } from "./ShortlistBar";
import styles from "./results.module.css";

export function ResultsView() {
  const hydrated = useHydrated();
  if (!hydrated) return <p className={styles.muted}>Loading…</p>;
  const profile = loadProfile();
  if (!profile) {
    return (
      <div className={styles.emptyState}>
        <h1>Let&rsquo;s start with their tastes</h1>
        <p>There&rsquo;s no profile saved on this device yet. It only takes a minute.</p>
        <Link href="/profile" className="btn btn-primary">
          Tell us about them
        </Link>
      </div>
    );
  }
  return <Results profile={profile} />;
}

type Phase =
  | { kind: "searching" }
  | { kind: "done"; response: RecommendResponse }
  | { kind: "error"; error: SearchErrorKind; fieldErrors: { path: string; message: string }[] }
  | { kind: "cancelled" };

function Results({ profile }: { profile: SeniorProfile }) {
  const [phase, setPhase] = useState<Phase>(() => {
    const cached = loadLastSearch(profile);
    return cached ? { kind: "done", response: cached } : { kind: "searching" };
  });
  // Bumped to start a search; the first one runs on mount unless a cached result exists.
  const [searchId, setSearchId] = useState(0);
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [fallback, setFallback] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackStore>(() => loadFeedback());
  const [feedbackAtSearch, setFeedbackAtSearch] = useState(() => JSON.stringify(loadFeedback()));
  // Top three the first time a result set is shown; the caregiver's picks after that.
  const [shortlist, setShortlist] = useState<string[]>(() =>
    phase.kind === "done" ? initialShortlist(phase.response.results) : [],
  );
  const abortRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searching = phase.kind === "searching";

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const fb = loadFeedback();
    runSearch(requestBody(profile, toRankingFeedback(fb)), {
      signal: controller.signal,
      onStep: (s) => setSteps((prev) => [...prev, s]),
      onFallback: () => setFallback(true),
    })
      .then((response) => {
        saveLastSearch(profile, response);
        const picks = defaultShortlist(response.results);
        saveShortlist(response.results, picks);
        setShortlist(picks);
        setFeedbackAtSearch(JSON.stringify(fb));
        setPhase({ kind: "done", response });
        setTimeout(() => headingRef.current?.focus(), 0);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const e = err instanceof SearchError ? err : new SearchError("unknown", null);
        setPhase({ kind: "error", error: e.kind, fieldErrors: e.fieldErrors });
      });
    return () => controller.abort();
    // searchId restarts the search; profile is fixed for this view.
  }, [searching, searchId, profile]);

  const startSearch = () => {
    setSteps([]);
    setFallback(false);
    clearShortlist();
    setShortlist([]);
    setPhase({ kind: "searching" });
    setSearchId((n) => n + 1);
    window.scrollTo({ top: 0 });
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase({ kind: "cancelled" });
  };

  const onVerdict = (id: string, name: string, v: Verdict | null) => {
    const next = setVerdict(feedback, id, name, v);
    setFeedback(next);
    saveFeedback(next);
  };

  const who = profile.displayName ?? "them";
  const feedbackChanged = JSON.stringify(feedback) !== feedbackAtSearch;

  if (phase.kind === "searching") {
    return <SearchProgress who={who} steps={steps} fallback={fallback} onCancel={cancel} />;
  }

  if (phase.kind === "cancelled") {
    return (
      <div className={styles.emptyState}>
        <h1>Search stopped</h1>
        <p>Nothing was changed. You can search again, or adjust the profile first.</p>
        <div className={styles.row}>
          <button type="button" className="btn btn-primary" onClick={startSearch}>
            Search again
          </button>
          <Link href="/profile" className="btn btn-secondary">
            Edit profile
          </Link>
        </div>
      </div>
    );
  }

  if (phase.kind === "error") {
    const copy = ERROR_COPY[phase.error];
    return (
      <div className={styles.emptyState} role="alert">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        {phase.fieldErrors.length > 0 && (
          <ul>
            {phase.fieldErrors.map((f) => (
              <li key={f.path}>
                {f.path.replace(/^profile\./, "")}: {f.message}
              </li>
            ))}
          </ul>
        )}
        <div className={styles.row}>
          {phase.error === "invalid" || phase.error === "location_not_found" ? (
            <Link href="/profile" className="btn btn-primary">
              {phase.error === "invalid" ? "Check the profile" : "Change the city"}
            </Link>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={startSearch}>
                Try again
              </button>
              <Link href="/profile" className="btn btn-secondary">
                Edit profile
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const { results, excluded, evidence, meta, trace } = phase.response;
  // Absent on results cached before Phase 5 / Phase 9c.
  const notices = phase.response.notices ?? [];
  const coverageNote = phase.response.coverageNote ?? null;
  const count = feedbackCount(feedback);

  // From the latest state, so quick taps in a row don't undo each other. The save is idempotent.
  const onToggleShortlist = (id: string) =>
    setShortlist((prev) => {
      const next = toggleShortlist(results, prev, id);
      saveShortlist(results, next);
      return next;
    });

  return (
    <div className={styles.results}>
      <div className={styles.resultsHead}>
        <h1 ref={headingRef} tabIndex={-1}>
          {results.length > 0 ? `Places ${who === "them" ? "they" : who} might enjoy` : "No suggestions this time"}
        </h1>
        <p className={styles.muted}>
          {results.length > 0 && `${results.length} suggestion${results.length === 1 ? "" : "s"} near ${meta.location}, best first. `}
          <Link href="/profile">Edit profile</Link>
        </p>
      </div>

      <p className={styles.persistentNotice} role="note">
        <Icon name="info" />
        <span>
          <strong>Tastora can&rsquo;t verify ingredients or allergens.</strong> Always confirm with the restaurant.
        </span>
      </p>

      {coverageNote && (
        <p className={styles.coverageNote} role="note">
          {coverageNote}
        </p>
      )}

      {notices.length > 0 && (
        <section className={styles.searchNotes} aria-labelledby="notes-h">
          <h2 id="notes-h">About this search</h2>
          <ul>
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {(feedbackChanged || count > 0) && (
        <div className={styles.againBar}>
          <p>
            {feedbackChanged
              ? "Your feedback is saved. Search again to use it."
              : `${count} piece${count === 1 ? "" : "s"} of feedback will be used in the next search.`}
          </p>
          <button type="button" className="btn btn-primary" onClick={startSearch}>
            Search again with your feedback
          </button>
        </div>
      )}

      {results.length === 0 ? (
        <div className={styles.emptyCard}>
          <p>
            No restaurants fit this search. Try another favourite cuisine, a nearby area or larger city, or fewer
            comfort needs.
          </p>
          <div className={styles.row}>
            <Link href="/profile" className="btn btn-primary">
              Edit profile
            </Link>
            <button type="button" className="btn btn-secondary" onClick={startSearch}>
              Search again
            </button>
          </div>
        </div>
      ) : (
        <>
          <ShortlistBar results={results} shortlist={shortlist} profileName={profile.displayName} />
          <ol className={styles.cards} aria-label="Suggestions, best first">
            {results.map((r) => (
              <li key={r.candidateId}>
                <ResultCard
                  result={r}
                  verdict={feedback.entries[r.candidateId]?.verdict ?? null}
                  onVerdict={(v) => onVerdict(r.candidateId, r.name, v)}
                  shortlisted={shortlist.includes(r.candidateId)}
                  onToggleShortlist={() => onToggleShortlist(r.candidateId)}
                />
              </li>
            ))}
          </ol>
        </>
      )}

      {excluded.length > 0 && (
        <details className={`${styles.details} ${styles.notShown}`}>
          <summary>
            Not shown ({excluded.length}) — and why
          </summary>
          <ul className={styles.sourced}>
            {excluded.map((e) => (
              <li key={e.id}>
                <strong>{e.name}</strong>
                {e.reasons.map((reason) => {
                  const { source, text } = splitSource(reason);
                  return (
                    <span key={reason} className={styles.source}>
                      {text}
                      {source && ` (${source})`}
                    </span>
                  );
                })}
              </li>
            ))}
          </ul>
        </details>
      )}

      <EvidencePanel evidence={evidence} />

      <details className={styles.details}>
        <summary>How Tastora searched ({trace.length} steps)</summary>
        <p className={styles.muted}>
          {meta.planner === "agent"
            ? `Planned by Claude (${meta.model}).`
            : `Planned by Tastora's built-in planner${meta.fallbackReason ? ` (${meta.fallbackReason})` : ""}.`}{" "}
          {meta.qlooCalls} Qloo request{meta.qlooCalls === 1 ? "" : "s"}, {(meta.durationMs / 1000).toFixed(1)} s.
        </p>
        <ol className={styles.traceList}>
          {trace.map((s) => (
            <li key={s.step}>
              <strong>{toolLabel(s.tool)}</strong>
              {s.inputSummary && ` — ${s.inputSummary}`}: {s.resultSummary}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
