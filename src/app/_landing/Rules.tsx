import { SectionHead } from "./Section";
import styles from "./landing.module.css";

// Each rule is true today and backed by a test; the test is named next to it. Keep them in step.
const RULES = [
  // tests/constraints.test.ts "allergies › is never matched, even with an 'Allergy friendly' venue tag",
  // "texture › is always needs_confirmation…"; tests/ui-helpers.test.ts "never shows an allergy or texture as matched"
  "Allergies and texture needs are never marked safe. They always say “Needs confirmation”.",
  // tests/constraints.test.ts "missing data › every requirement is needs_confirmation when Qloo has no relevant tags"
  "Missing information means “Needs confirmation”, not a match.",
  // tests/constraints.test.ts "removes dishes commonly made with the allergen (suya)…";
  // tests/explanation-facts.test.ts "allergen dishes never reach dishesToAskAbout"
  "Dishes that commonly contain an allergen are set aside, not suggested.",
  // tests/explanation-facts.test.ts "explains Buka with sourced reasons", "only cites dishes and tags the candidate
  // actually has"; tests/constraints.test.ts "every evidence and warning string names its source"
  "Every reason shows where it came from.",
  // tests/agent.test.ts "statuses come from Phase 2, not the model", "rejects invented ids…"
  "The AI plans the search. Tested code makes every safety decision.",
  // tests/agent.test.ts "never sends allergies, restrictions, texture, comfort or display name to the model"
  "Allergies and diet rules are never sent to the AI model.",
  // tests/ui-helpers.test.ts "only allows http(s) links and clean tel: hrefs", and its banned-words scan of UI copy;
  // tests/explanation-facts.test.ts "omits links Qloo did not provide…"
  "Links go to the restaurant’s own website, phone and map. Tastora takes no payments.",
] as const;

export function Rules() {
  return (
    <section id="rules" className={styles.section} aria-labelledby="rules-h">
      <div className={styles.stack}>
        <SectionHead id="rules-h" eyebrow="Our rules" title="Rules Tastora keeps," muted="enforced in code." />
        <ol className={styles.numbered}>
          {RULES.map((text, i) => (
            <li key={text} className={styles.numberedRow}>
              <span className={styles.num} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p className="mono">Each rule has an automated test in the public repository.</p>
      </div>
    </section>
  );
}
