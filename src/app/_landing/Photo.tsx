// Landing photos, all from Pexels under the Pexels License (free to use and modify; no endorsement
// implied), downloaded into public/images/ and served through next/image so each device gets a
// resized copy. Credited under each photo, in the footer and in the README.
//  - family-dinner.jpg: photo 11368637 by Anna Shvets (downloaded 2026-10-28)
//  - shared-plates.jpg: photo 31705508 by Juan TM (downloaded 2026-10-28, 2000px; Closing.tsx)
import Image, { type StaticImageData } from "next/image";
import familyDinner from "../../../public/images/family-dinner.jpg";
import styles from "./landing.module.css";

const PHOTOS: Record<"dinner", { src: StaticImageData; alt: string; by: string; page: string; position: string }> = {
  dinner: {
    src: familyDinner,
    alt: "Three generations around a candlelit dinner table at home: two older women and a young girl smile and talk over plates, glasses and a sweet pie.",
    by: "Anna Shvets",
    page: "https://www.pexels.com/photo/a-family-eating-dinner-together-11368637/",
    position: "45% 30%",
  },
};

export function Photo({ which = "dinner", className = "" }: { which?: keyof typeof PHOTOS; className?: string }) {
  const p = PHOTOS[which];
  return (
    <figure className={`${styles.photo} ${className}`}>
      <div className={styles.photoFrame}>
        <Image
          src={p.src}
          alt={p.alt}
          placeholder="blur"
          sizes="(max-width: 900px) calc(100vw - 2rem), 560px"
          className={styles.photoImg}
          style={{ objectPosition: p.position }}
        />
      </div>
      <figcaption className={`mono ${styles.credit}`}>
        Photo:{" "}
        <a href={p.page} target="_blank" rel="noopener noreferrer" className={styles.creditLink}>
          {p.by} on Pexels<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  );
}
