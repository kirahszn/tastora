// Original flat illustration: two people sharing a meal by a window, a plant, a steaming dish and a
// record on the wall. Decorative; colours come from --ill-* in landing.module.css (dimmed in dark mode).
import styles from "./landing.module.css";

export function Illustration() {
  return (
    <div className={styles.illustration}>
      <svg viewBox="0 0 960 380" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
        {/* Room */}
        <rect width="960" height="380" fill="var(--ill-wall)" />
        <rect y="318" width="960" height="62" fill="var(--ill-floor)" />

        {/* Window and its soft light */}
        <path d="M384 196h192l120 122H264z" fill="var(--ill-light)" />
        <rect x="384" y="40" width="192" height="156" rx="10" fill="var(--ill-window)" />
        <rect x="384" y="40" width="192" height="156" rx="10" fill="none" stroke="var(--ill-frame)" strokeWidth="8" />
        <path d="M480 44v148M388 118h184" stroke="var(--ill-frame)" strokeWidth="6" />
        <circle cx="530" cy="78" r="16" fill="var(--ill-butter)" />

        {/* A record on the wall: the music they love */}
        <rect x="118" y="58" width="104" height="104" rx="10" fill="var(--ill-lavender)" />
        <circle cx="170" cy="110" r="38" fill="var(--ill-ink)" />
        <circle cx="170" cy="110" r="26" fill="none" stroke="var(--ill-wall)" strokeOpacity="0.25" strokeWidth="2" />
        <circle cx="170" cy="110" r="12" fill="var(--ill-terracotta)" />
        <circle cx="170" cy="110" r="2.5" fill="var(--ill-ink)" />

        {/* Plant */}
        <path d="M790 252h76l-10 66h-56z" fill="var(--ill-terracotta)" />
        <path d="M828 252c-4-40-30-62-60-70 8 34 28 58 60 70z" fill="var(--ill-sage)" />
        <path d="M828 252c2-46 26-78 58-90-2 40-22 72-58 90z" fill="var(--ill-sage-deep)" />
        <path d="M828 252c-2-56 4-92 18-120 12 30 8 76-18 120z" fill="var(--ill-sage)" />

        {/* Chairs */}
        <rect x="214" y="168" width="18" height="150" rx="9" fill="var(--ill-wood)" />
        <rect x="214" y="262" width="90" height="14" rx="7" fill="var(--ill-wood)" />
        <rect x="728" y="168" width="18" height="150" rx="9" fill="var(--ill-wood)" />
        <rect x="656" y="262" width="90" height="14" rx="7" fill="var(--ill-wood)" />

        {/* Left person */}
        <rect x="246" y="168" width="84" height="104" rx="34" fill="var(--ill-lavender-deep)" />
        <path d="M264 262h108v24H290v32h-26z" fill="var(--ill-trousers)" />
        <circle cx="290" cy="134" r="28" fill="var(--ill-skin-a)" />
        <path d="M262 132a28 28 0 0 1 56-4c-12 0-26-6-34-14-4 8-12 14-22 18z" fill="var(--ill-hair-a)" />
        <circle cx="270" cy="112" r="11" fill="var(--ill-hair-a)" />
        <rect x="300" y="208" width="82" height="20" rx="10" fill="var(--ill-lavender-deep)" />
        <circle cx="382" cy="218" r="10" fill="var(--ill-skin-a)" />

        {/* Right person */}
        <rect x="630" y="168" width="84" height="104" rx="34" fill="var(--ill-sage-deep)" />
        <path d="M696 262H588v24h82v32h26z" fill="var(--ill-trousers)" />
        <circle cx="670" cy="134" r="28" fill="var(--ill-skin-b)" />
        <path d="M642 130a28 28 0 0 1 56 0c-6-6-18-10-28-10s-22 4-28 10z" fill="var(--ill-hair-b)" />
        <rect x="578" y="208" width="82" height="20" rx="10" fill="var(--ill-sage-deep)" />
        <circle cx="578" cy="218" r="10" fill="var(--ill-skin-b)" />

        {/* Table */}
        <rect x="468" y="250" width="24" height="68" fill="var(--ill-wood)" />
        <ellipse cx="480" cy="318" rx="54" ry="8" fill="var(--ill-wood)" />
        <rect x="320" y="226" width="320" height="26" rx="13" fill="var(--ill-butter)" />

        {/* Plates, glasses and the shared dish */}
        <ellipse cx="392" cy="226" rx="40" ry="7" fill="var(--ill-plate)" />
        <ellipse cx="568" cy="226" rx="40" ry="7" fill="var(--ill-plate)" />
        <rect x="430" y="196" width="14" height="30" rx="4" fill="var(--ill-window)" />
        <rect x="516" y="196" width="14" height="30" rx="4" fill="var(--ill-window)" />
        <path d="M448 204h64a32 22 0 0 1-64 0z" fill="var(--ill-terracotta)" />
        <path d="M444 204h72" stroke="var(--ill-terracotta)" strokeWidth="6" strokeLinecap="round" />
        <path
          d="M468 190c-6-8 6-12 0-22M480 188c-6-8 6-12 0-22M492 190c-6-8 6-12 0-22"
          fill="none"
          stroke="var(--ill-steam)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
