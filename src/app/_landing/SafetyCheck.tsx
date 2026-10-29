import { SectionHead } from "./Section";
import { Sieve } from "./Sieve";
import { sieveSamples } from "./sieveData";
import styles from "./landing.module.css";

export function SafetyCheck() {
  return (
    <section className={styles.section} aria-labelledby="sieve-h">
      <SectionHead id="sieve-h" eyebrow="The safety check" title="We set dishes aside." muted="We never call one safe.">
        <p>
          Tastora checks each dish Qloo lists and sets aside any commonly made with an allergen. The allergy itself
          always needs confirming with the restaurant.
        </p>
      </SectionHead>
      <Sieve places={sieveSamples()} />
    </section>
  );
}
