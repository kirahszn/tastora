import { SectionHead } from "./Section";
import { SeeItWorkDemo } from "./SeeItWorkDemo";
import { sieveSamples } from "./sieveData";
import styles from "./landing.module.css";

export function SeeItWork() {
  return (
    <section id="see" className={styles.section} aria-labelledby="see-h">
      <SectionHead id="see-h" eyebrow="See it work" title="Their tastes in." muted="Questions to ask out.">
        <p>Three steps on real Qloo data. We set dishes aside; we never call one safe.</p>
      </SectionHead>
      <SeeItWorkDemo places={sieveSamples()} />
    </section>
  );
}
