import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.welcome}>
      <p className={styles.kicker}>For caregivers in New York City</p>
      <h1 className={styles.title}>Good food should still feel like home.</h1>
      <div className={styles.lede}>
        <p>
          Tell Tastora what someone you care for loves: favourite foods, and the music, films and places that feel
          familiar. It suggests New York restaurants that suit their own tastes, keeping their allergies and needs
          separate. For every place, you&rsquo;ll see why it was suggested and what to ask before you go.
        </p>
      </div>

      <div className={styles.actions}>
        <Link href="/profile" className="btn btn-primary">
          Find food for someone you care for
        </Link>
        <Link href="/profile#examples" className="btn btn-secondary">
          Try an example
        </Link>
      </div>

      <p className={styles.honest}>
        <span aria-hidden="true">ⓘ </span>
        Tastora suggests restaurants and tells you what to check — it can&rsquo;t confirm ingredients or allergens.
      </p>

      <ol className={styles.steps} aria-label="How it works">
        <li>
          <h2>Their tastes</h2>
          <p>Favourite foods, plus taste memories like a singer they love.</p>
        </li>
        <li>
          <h2>Their needs</h2>
          <p>Allergies, diet, texture and comfort, checked by Tastora&rsquo;s own rules.</p>
        </li>
        <li>
          <h2>Places to ask about</h2>
          <p>Suggestions with reasons, dishes to ask about and questions for the restaurant.</p>
        </li>
      </ol>
    </div>
  );
}
