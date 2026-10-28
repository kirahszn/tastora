// Tastora's mark: an original little chef (puffed hat, round smiling face). Decorative; the
// "Tastora" wordmark beside it is the accessible name. Also drawn by the share card; the favicon
// (src/app/icon.svg) is a copy of these shapes on a terracotta tile, so change them together.
// Outlines are a wide espresso stroke under a fill-only copy, so overlapping puffs read as one hat.
const INK = "#2b1d16";
const HAT = "#fffbf7";
const FACE = "#fbe3d6";
const CHEEK = "#d9774f";

export function ChefMark({ size = 32 }: { size?: number }) {
  const hat = (
    <>
      <circle cx="10.5" cy="9" r="4.5" />
      <circle cx="16" cy="7" r="5" />
      <circle cx="21.5" cy="9" r="4.5" />
      <rect x="9.5" y="9" width="13" height="7.5" rx="1.5" />
    </>
  );
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
      <circle cx="16" cy="21.5" r="8.2" fill={FACE} stroke={INK} strokeWidth="1.8" />
      <circle cx="13" cy="21.2" r="1.15" fill={INK} />
      <circle cx="19" cy="21.2" r="1.15" fill={INK} />
      <circle cx="11.2" cy="24" r="1.35" fill={CHEEK} />
      <circle cx="20.8" cy="24" r="1.35" fill={CHEEK} />
      <path d="M13 24.6c1.8 1.9 4.2 1.9 6 0" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <g fill={INK} stroke={INK} strokeWidth="3.6" strokeLinejoin="round">
        {hat}
      </g>
      <g fill={HAT}>{hat}</g>
      <path d="M10.2 13.6h11.6" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
