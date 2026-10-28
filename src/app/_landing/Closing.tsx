import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SectionHead } from "./Devices";
import styles from "./landing.module.css";

export function Closing() {
  return (
    <section className={styles.closing} aria-labelledby="closing-h">
      <SectionHead id="closing-h" eyebrow="Honest by design" title="We never call a meal safe">
        <p className={styles.headText}>
          Restaurants rarely publish ingredients or allergens, so Tastora tells you what to check instead of guessing.
        </p>
      </SectionHead>
      <Link href="/profile#examples" className={`btn btn-primary ${styles.cta}`}>
        Try the Sinatra example
        <span className={styles.arrow}>
          <Icon name="arrow" size={18} />
        </span>
      </Link>
    </section>
  );
}
