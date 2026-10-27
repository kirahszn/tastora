import Link from "next/link";
import { Icon } from "@/components/Icon";
import styles from "./landing.module.css";
import { SampleCard } from "./SampleCard";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-h">
      <div className={styles.heroText}>
        <p className={styles.eyebrow}>Tastora · For caregivers in NYC</p>
        <h1 id="hero-h" className={styles.headline}>
          Good food should still feel <span className={styles.headlineAccent}>like home.</span>
        </h1>
        <p className={styles.lede}>
          Tell us what someone you care for loves, from favourite dishes to the singer they still hum along to.
          Tastora finds New York restaurants that fit their taste, and tells you exactly what to ask before you go.
        </p>
        <div className={styles.heroActions}>
          <Link href="/profile" className={`btn btn-primary ${styles.cta}`}>
            Find food for someone you care for
            <span className={styles.arrow}>
              <Icon name="arrow" size={18} />
            </span>
          </Link>
          <Link href="/profile#examples" className={styles.textLink}>
            or see an example
          </Link>
        </div>
      </div>
      <SampleCard />
    </section>
  );
}
