import { Icon } from "@/components/Icon";
import styles from "./landing.module.css";

export function TrustStrip() {
  return (
    <p className={styles.trust}>
      <Icon name="info" size={22} />
      <span>
        Tastora suggests restaurants and tells you what to check. It can&rsquo;t confirm ingredients or allergens.
        Always ask the restaurant.
      </span>
    </p>
  );
}
