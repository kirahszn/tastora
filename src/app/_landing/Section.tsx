import styles from "./landing.module.css";

/** Eyebrow, two-tone heading (first clause espresso, second muted) and an optional intro. */
export function SectionHead({
  id,
  eyebrow,
  title,
  muted,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  muted: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.head}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className={styles.sectionTitle}>
        {title} <span className="tone-muted">{muted}</span>
      </h2>
      {children && <div className={styles.headText}>{children}</div>}
    </div>
  );
}
