// Original flat cuisine illustrations (Phase 12), drawn for Tastora in the site palette. Shown when
// Qloo has no image for a place, chosen from its cuisine tags (cuisineArtFor). Always decorative:
// they show a kind of food, never a restaurant's own dish.
import type { CuisineArtKind } from "@/lib/ui/cuisineArt";

const C = {
  plate: "#ffffff",
  rim: "#eadfd2",
  well: "#fbf0e6",
  terracotta: "#d9774f",
  deep: "#a44f2e",
  sage: "#5e7a5a",
  leaf: "#8fae83",
  butter: "#e9bf5f",
  pale: "#f3dcae",
  cream: "#fffbf7",
  ink: "#2b1d16",
  salmon: "#ef8f66",
};

/** One slice of a circle, for the bibimbap toppings. */
function wedge(i: number, n: number, r: number, cx = 32, cy = 32) {
  const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
  const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
  const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  return `M${cx} ${cy}L${p(a0)}A${r} ${r} 0 0 1 ${p(a1)}Z`;
}

const plate = (
  <>
    <circle cx="32" cy="32" r="29" fill={C.plate} stroke={C.rim} strokeWidth="2" />
    <circle cx="32" cy="32" r="22" fill={C.well} />
  </>
);

const ART: Record<CuisineArtKind, React.ReactNode> = {
  italian: (
    <>
      {plate}
      <g fill="none" stroke={C.butter} strokeWidth="2.6" strokeLinecap="round">
        <path d="M32 18a14 14 0 1 1-13.6 10.6" />
        <path d="M32 22a10 10 0 1 0 9.7 7.6" />
        <path d="M24 33a8 8 0 0 1 13-6" />
      </g>
      <circle cx="32" cy="31" r="5.5" fill={C.terracotta} />
      <circle cx="30.5" cy="29.5" r="1.4" fill={C.salmon} />
      <ellipse cx="38" cy="25" rx="4.2" ry="2.2" fill={C.sage} transform="rotate(-35 38 25)" />
      <ellipse cx="41" cy="29" rx="3.6" ry="1.9" fill={C.leaf} transform="rotate(20 41 29)" />
    </>
  ),
  westAfrican: (
    <>
      {plate}
      <path d="M14 34c0-9 8-16 17-16 7 0 12 4 13 10-2 9-10 15-19 15-6 0-11-3-11-9z" fill={C.terracotta} />
      {[
        [20, 30],
        [25, 25],
        [31, 23],
        [36, 27],
        [24, 35],
        [30, 31],
        [35, 34],
        [28, 39],
        [19, 37],
      ].map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.6" ry="0.9" fill={C.salmon} />
      ))}
      {[
        [44, 38],
        [40, 45],
        [47, 30],
      ].map(([x, y]) => (
        <g key={`p${x}`}>
          <ellipse cx={x} cy={y} rx="5" ry="3.6" fill={C.butter} transform={`rotate(-25 ${x} ${y})`} />
          <ellipse cx={x} cy={y} rx="3" ry="2" fill={C.pale} transform={`rotate(-25 ${x} ${y})`} />
        </g>
      ))}
      <path d="M22 24c2-3 5-3 6-1" stroke={C.sage} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  caribbean: (
    <>
      {plate}
      <path d="M12 34a20 20 0 0 1 20-20v20z" fill={C.cream} stroke={C.rim} />
      {[
        [18, 28],
        [23, 23],
        [27, 29],
        [20, 33],
        [28, 20],
        [16, 32],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill={C.deep} />
      ))}
      <ellipse cx="38" cy="37" rx="9" ry="7" fill={C.deep} transform="rotate(-30 38 37)" />
      <path d="M44 31l6-5" stroke={C.cream} strokeWidth="3" strokeLinecap="round" />
      <circle cx="51" cy="25" r="2" fill={C.cream} />
      <path d="M33 37l3-2M37 40l3-2M36 33l2-1" stroke={C.terracotta} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 44a7 7 0 0 0 12 4z" fill={C.leaf} stroke={C.sage} strokeWidth="1.5" />
    </>
  ),
  chinese: (
    <>
      <circle cx="30" cy="34" r="25" fill={C.terracotta} />
      <circle cx="30" cy="34" r="20" fill={C.pale} />
      <g fill="none" stroke={C.butter} strokeWidth="2.4" strokeLinecap="round">
        <path d="M15 30c4-3 6 3 10 0s6 3 10 0 6 3 10 0" />
        <path d="M14 36c4-3 6 3 10 0s6 3 10 0 6 3 10 0" />
        <path d="M17 42c4-3 6 3 10 0s6 3 10 0 5 2 8 0" />
      </g>
      <circle cx="22" cy="26" r="2" fill={C.leaf} />
      <circle cx="37" cy="45" r="2" fill={C.leaf} />
      <circle cx="40" cy="27" r="2" fill={C.sage} />
      <path d="M35 4l24 22M41 3l20 19" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  indian: (
    <>
      <circle cx="32" cy="32" r="29" fill={C.pale} stroke={C.butter} strokeWidth="2" />
      <circle cx="21" cy="22" r="8" fill={C.plate} />
      <circle cx="21" cy="22" r="6" fill={C.butter} />
      <circle cx="40" cy="19" r="8" fill={C.plate} />
      <circle cx="40" cy="19" r="6" fill={C.terracotta} />
      <circle cx="44" cy="37" r="8" fill={C.plate} />
      <circle cx="44" cy="37" r="6" fill={C.sage} />
      <path d="M14 38c4-4 12-4 16 2 3 5 0 12-7 12-6 0-11-6-9-14z" fill={C.cream} stroke={C.rim} />
      <ellipse cx="33" cy="50" rx="7" ry="4" fill="#efd2a0" transform="rotate(-15 33 50)" />
      <circle cx="31" cy="49" r="0.9" fill={C.deep} />
      <circle cx="35" cy="51" r="0.9" fill={C.deep} />
    </>
  ),
  mexican: (
    <>
      {plate}
      {[22, 42].map((x) => (
        <g key={x}>
          <path d={`M${x - 11} 38a11 11 0 0 1 22 0z`} fill={C.butter} />
          <circle cx={x - 5} cy={33} r="2.2" fill={C.leaf} />
          <circle cx={x} cy={31} r="2.2" fill={C.terracotta} />
          <circle cx={x + 5} cy={33} r="2.2" fill={C.sage} />
          <circle cx={x + 2} cy={34} r="1.4" fill={C.cream} />
          <path d={`M${x - 11} 38h22`} stroke="#c99a3e" strokeWidth="1.5" />
        </g>
      ))}
      <path d="M26 46a6 6 0 0 0 10 0z" fill={C.leaf} stroke={C.sage} strokeWidth="1.5" />
    </>
  ),
  japanese: (
    <>
      <rect x="6" y="18" width="52" height="30" rx="4" fill="#d9b78a" />
      <rect x="6" y="44" width="52" height="4" rx="2" fill="#c49c6c" />
      {[17, 32, 47].map((x) => (
        <g key={x}>
          <circle cx={x} cy="29" r="7" fill={C.ink} />
          <circle cx={x} cy="29" r="5.4" fill={C.cream} />
          <circle cx={x} cy="29" r="2.4" fill={C.salmon} />
        </g>
      ))}
      <ellipse cx="32" cy="41" rx="11" ry="3.2" fill={C.cream} />
      <ellipse cx="32" cy="39.5" rx="11" ry="2.8" fill={C.salmon} />
      <path d="M26 39l2 2M31 38.5l2 2M36 38.5l2 2" stroke={C.cream} strokeWidth="1" />
    </>
  ),
  korean: (
    <>
      <circle cx="32" cy="32" r="28" fill={C.ink} />
      <circle cx="32" cy="32" r="23" fill={C.cream} />
      {[C.sage, C.terracotta, C.butter, C.leaf, C.deep, C.salmon].map((fill, i) => (
        <path key={fill} d={wedge(i, 6, 21)} fill={fill} />
      ))}
      <path d="M24 30c0-5 4-8 8-8s9 3 9 8-4 9-9 9-8-4-8-9z" fill={C.plate} />
      <circle cx="32" cy="31" r="4" fill={C.butter} />
    </>
  ),
  middleEastern: (
    <>
      {plate}
      <circle cx="30" cy="34" r="15" fill={C.pale} />
      <path d="M30 24a10 10 0 1 1-9.5 13M30 28a6 6 0 1 0 5.7 7.6" fill="none" stroke="#d9b78a" strokeWidth="2" />
      <circle cx="30" cy="34" r="2.6" fill={C.butter} />
      <circle cx="33" cy="31" r="1.2" fill={C.terracotta} />
      <circle cx="27" cy="36" r="1.2" fill={C.terracotta} />
      <path d="M44 12l10 14-14 2z" fill="#efd2a0" stroke="#d9b78a" />
      <path d="M48 32l9 9-12 3z" fill="#efd2a0" stroke="#d9b78a" />
      <circle cx="19" cy="17" r="2.6" fill={C.sage} />
      <circle cx="14" cy="22" r="2.6" fill={C.sage} />
    </>
  ),
  plate: (
    <>
      {plate}
      <path d="M17 40a15 15 0 0 1 30 0z" fill={C.terracotta} />
      <path d="M14 40h36" stroke={C.deep} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="23" r="2.6" fill={C.deep} />
      <path d="M25 33a8 8 0 0 1 5-5" stroke={C.salmon} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
};

export function CuisineArt({ kind, size = 64, className }: { kind: CuisineArtKind; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {ART[kind]}
    </svg>
  );
}
