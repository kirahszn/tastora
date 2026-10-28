import { Icon } from "@/components/Icon";
import styles from "./landing.module.css";

const VALUES = [
  {
    icon: "heart",
    tint: styles.cardPeach,
    title: "Built on their taste",
    text: "Favourite foods plus taste memories, matched through Qloo’s taste graph.",
  },
  {
    icon: "shield",
    tint: styles.cardSage,
    title: "Honest about safety",
    text: "Allergies and texture are never marked safe. You get the questions to ask instead.",
  },
  {
    icon: "share",
    tint: styles.cardLavender,
    title: "Easy to share",
    text: "Send a shortlist to family or print a checklist for calling ahead.",
  },
] as const;

export function Values() {
  return (
    <section aria-labelledby="values-h">
      <h2 id="values-h" className="sr-only">
        What Tastora does differently
      </h2>
      <ul className={styles.values}>
        {VALUES.map((v) => (
          <li key={v.title} className={`${styles.value} ${v.tint}`}>
            <span className={styles.valueIcon}>
              <Icon name={v.icon} size={28} />
            </span>
            <h3 className={styles.valueTitle}>{v.title}</h3>
            <p>{v.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
