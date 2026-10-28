import { SectionHead } from "./Section";
import { Sieve } from "./Sieve";
import { sieveSamples } from "./sieveData";
import styles from "./landing.module.css";

export function SafetyCheck() {
  return (
    <section className={styles.section} aria-labelledby="sieve-h">
      <SectionHead id="sieve-h" eyebrow="The safety check" title="We set dishes aside." muted="We never call one safe.">
        <p>
          Restaurants rarely publish ingredients, so Tastora checks every dish name Qloo lists against the person&rsquo;s
          needs. Dishes that mention an allergen, or are commonly made with it, are set aside. Everything else is a
          dish to ask about, and the allergy itself always needs confirming with the restaurant.
        </p>
      </SectionHead>
      <Sieve places={sieveSamples()} />
    </section>
  );
}
