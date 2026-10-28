// Laptop and phone frames drawn in CSS around real screenshots of Tastora (public/images/screen-*,
// captured 2026-10-28 from the live app with the Sinatra-example response of 2026-10-27).
import styles from "./landing.module.css";

export function Laptop({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.laptop}>
      <div className={styles.laptopLid}>
        <div className={styles.laptopScreen}>{children}</div>
      </div>
      <div className={styles.laptopBase} aria-hidden="true" />
    </div>
  );
}

export function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.phone}>
      <div className={styles.phoneScreen}>{children}</div>
    </div>
  );
}

export function SectionHead({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className={styles.head}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {children}
    </div>
  );
}
