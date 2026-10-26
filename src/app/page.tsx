import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Tastora</h1>
      <p className={styles.tagline}>Good food should still feel like home.</p>
      <p className={styles.description}>
        Find restaurant meals that match the tastes of someone you care for.
      </p>
      <button
        type="button"
        className={styles.button}
        disabled
        aria-describedby="coming-soon"
      >
        Find food for someone you care for
      </button>
      <p id="coming-soon" className={styles.note}>
        Coming soon — Tastora is in development.
      </p>
    </main>
  );
}
