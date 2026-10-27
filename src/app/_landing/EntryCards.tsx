import Link from "next/link";
import { Icon } from "@/components/Icon";
import styles from "./landing.module.css";

export function EntryCards() {
  return (
    <section className={styles.entries} aria-label="Ways to start">
      <div className={styles.entry}>
        <p className={styles.eyebrow}>Start fresh</p>
        <h2 className={styles.entryTitle}>Find food for someone you care for.</h2>
        <p className={styles.entryText}>Share their tastes and needs. Get NYC places picked for them, with reasons.</p>
        <Link href="/profile" className={`btn btn-primary ${styles.cta}`}>
          Get started
          <span className={styles.arrow}>
            <Icon name="arrow" size={18} />
          </span>
        </Link>
      </div>
      <div className={`${styles.entry} ${styles.entryAlt}`}>
        <p className={styles.eyebrow}>See it first</p>
        <h2 className={styles.entryTitle}>Try an example.</h2>
        <p className={styles.entryText}>See how Tastora finds places for a Frank Sinatra fan in Queens.</p>
        <div className={styles.entryActions}>
          <Link href="/profile#examples" className={`btn btn-secondary ${styles.cta}`}>
            Try the example
            <span className={styles.arrow}>
              <Icon name="arrow" size={18} />
            </span>
          </Link>
          <span className={styles.entryNote}>No sign-up needed.</span>
        </div>
      </div>
    </section>
  );
}
