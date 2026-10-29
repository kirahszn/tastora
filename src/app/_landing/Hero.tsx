import Link from "next/link";
import { Icon } from "@/components/Icon";
import { HeroPreview } from "./HeroPreview";
import styles from "./landing.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-h">
      <div className={styles.heroText}>
        <p className="eyebrow">For caregivers</p>
        <h1 id="hero-h" className={styles.headline}>
          Good food should still feel like home.{" "}
          <span className="tone-muted">Find restaurants that fit their taste, and know what to ask before you go.</span>
        </h1>
        <div className={styles.ctaRow}>
          <Link href="/profile" className={`btn btn-primary ${styles.cta}`}>
            Find food for someone you care for
            <span className={styles.arrow}>
              <Icon name="arrow" size={18} />
            </span>
          </Link>
          <Link href="/profile#examples" className="btn btn-secondary">
            Try an example
          </Link>
        </div>
        <p className="mono">Free · No sign-up</p>
      </div>
      <HeroPreview />
    </section>
  );
}
