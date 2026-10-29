"use client";
// The caregiver's shortlist: share it as plain text (share sheet, WhatsApp, clipboard) or open the
// print checklist. The text is built here on the device; nothing is sent to Tastora's server.
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { buildShareText, shareHeading, whatsappUrl } from "@/lib/ui/share";
import type { RecommendResult } from "@/lib/ui/types";
import styles from "./results.module.css";

const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;

/** Clipboard API, then the older select-and-copy for browsers or contexts without it. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function ShortlistBar({
  results,
  shortlist,
  profileName,
}: {
  results: RecommendResult[];
  shortlist: string[];
  profileName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const count = shortlist.length;
  const text = buildShareText(results, shortlist, profileName);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const share = async () => {
    try {
      await navigator.share({ title: shareHeading(profileName), text });
    } catch {
      // Closing the share sheet rejects too; the copy and WhatsApp options stay available.
    }
  };

  const copy = async () => {
    setStatus((await copyText(text)) ? "Copied" : "Couldn't copy. Select the text below and copy it.");
  };

  return (
    <section className={styles.shortlistBar} aria-labelledby="shortlist-h">
      <div className={styles.shortlistRow}>
        <h2 id="shortlist-h" className={styles.shortlistCount}>
          {count === 0 ? "No places in your shortlist" : `${count} place${count === 1 ? "" : "s"} shortlisted`}
        </h2>
        <div className={styles.shortlistActions}>
          <button
            type="button"
            className="btn btn-primary"
            aria-expanded={open}
            aria-controls="share-panel"
            disabled={count === 0}
            onClick={() => {
              setOpen((o) => !o);
              setStatus("");
            }}
          >
            <Icon name="share" /> Share
          </button>
          {count > 0 ? (
            <Link href="/results/print" className="btn btn-secondary">
              <Icon name="print" /> Print<span className={styles.wideOnly}> checklist</span>
            </Link>
          ) : (
            <button type="button" className="btn btn-secondary" disabled>
              <Icon name="print" /> Print<span className={styles.wideOnly}> checklist</span>
            </button>
          )}
        </div>
      </div>
      {count === 0 && <p className={styles.shortlistHint}>Choose &ldquo;Add to shortlist&rdquo; on a place to share it.</p>}

      {open && count > 0 && (
        <div id="share-panel" className={styles.sharePanel}>
          <p className={styles.shortlistHint}>
            This is the text you&rsquo;ll share. It&rsquo;s made on this device; nothing is sent to Tastora.
          </p>
          <div className={styles.shareButtons}>
            {canShare && (
              <button type="button" className="btn btn-primary" onClick={share}>
                <Icon name="share" /> Share…
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={copy}>
              <Icon name="copy" /> Copy text
            </button>
            <a className="btn btn-secondary" href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer">
              <Icon name="external" /> Open in WhatsApp{NEW_TAB}
            </a>
          </div>
          <p className={styles.copyStatus} role="status" aria-live="polite">
            {status}
          </p>
          <pre className={styles.sharePreview} tabIndex={0} aria-label="Text to share">
            {text}
          </pre>
        </div>
      )}
    </section>
  );
}
