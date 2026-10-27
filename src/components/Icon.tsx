// Small inline icons. Always decorative: the text next to them carries the meaning.
import type { StatusIcon } from "@/lib/ui/status";

type Name =
  | StatusIcon
  | "alert"
  | "info"
  | "external"
  | "phone"
  | "map"
  | "shield"
  | "share"
  | "print"
  | "copy"
  | "plus"
  | "heart"
  | "sparkle"
  | "ask"
  | "arrow";

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
  share: "M12 15V4M8 8l4-4 4 4M5 12v7h14v-7",
  print: "M7 9V4h10v5M7 17H5v-7h14v7h-2M7 14h10v6H7z",
  copy: "M9 9h10v11H9zM5 15V4h10",
  plus: "M12 5v14M5 12h14",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z",
  sparkle: "M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9-1.9 5.6-1.9-5.6-5.6-1.9 5.6-1.9zM18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z",
  ask: "M4.5 5.5h15v10h-8l-4.5 3.5v-3.5H4.5zM10.2 8.8a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1M12 13.4v.01",
  arrow: "M5 12h14M13 6l6 6-6 6",
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
