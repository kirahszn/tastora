import { SectionHead } from "./Section";
import { SeeItWorkDemo } from "./SeeItWorkDemo";
import { sieveSamples } from "./sieveData";
import styles from "./landing.module.css";

export function SeeItWork() {
  return (
    <section id="how" className={styles.section} aria-labelledby="see-h">
      <SectionHead id="see-h" eyebrow="See it work" title="Their tastes in." muted="Questions to ask out.">
        <p>
          An AI agent plans the search. Qloo ranks restaurants near them by taste. Tested code checks every need: we set
          dishes aside, and we never call one safe. Three steps, on real Qloo data:
        </p>
      </SectionHead>
      <SeeItWorkDemo places={sieveSamples()} />
    </section>
  );
}
