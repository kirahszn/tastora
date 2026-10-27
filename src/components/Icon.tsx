// Small inline icons. Always decorative: the text next to them carries the meaning.
import type { StatusIcon } from "@/lib/ui/status";

type Name = StatusIcon | "alert" | "info" | "external" | "phone" | "map" | "shield";

const PATHS: Record<Name, string> = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  question: "M9.2 9a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1.1-1.5 2.1V15M12 18.5v.01",
  cross: "M7 7l10 10M17 7L7 17",
  alert: "M12 4l9 16H3L12 4zM12 10v4.5M12 17.5v.01",
  info: "M12 8v.01M11 12h1v5h1",
  external: "M14 5h5v5M19 5l-8 8M18 14v5H5V6h5",
  phone: "M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L16 13l4 1.5v3A2 2 0 0 1 18 19.5 15 15 0 0 1 4.5 6 2 2 0 0 1 6.5 4z",
  shield: "M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6L12 3zM8.8 12l2.3 2.3 4.1-4.3",
  map: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
};

export function Icon({ name, size = 18 }: { name: Name; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {name === "info" && <circle cx="12" cy="12" r="9" />}
      <path d={PATHS[name]} />
    </svg>
  );
}
