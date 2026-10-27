import type { RequirementResult } from "@/lib/ui/types";
import { displayStatus, requirementLabel } from "@/lib/ui/status";
import { Icon } from "./Icon";
import styles from "./StatusBadge.module.css";

/** One requirement and its status: icon + status text + requirement, never colour alone. */
export function StatusBadge({ requirement }: { requirement: Pick<RequirementResult, "kind" | "status" | "requirement"> }) {
  const status = displayStatus(requirement);
  return (
    <span className={`${styles.badge} ${styles[status.tone]}`}>
      <Icon name={status.icon} size={16} />
      <span className={styles.status}>{status.label}</span>
      <span className={styles.requirement}>{requirementLabel(requirement.requirement)}</span>
    </span>
  );
}
