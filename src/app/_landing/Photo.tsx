// Landing photo band. Pexels photo 11368637 by Anna Shvets, used under the Pexels License (free
// to use and modify; no endorsement implied). Downloaded 2026-10-28 into public/images/; served
// through next/image so it is resized per device. Credited below the photo and in the README.
import Image from "next/image";
import familyDinner from "../../../public/images/family-dinner.jpg";
import styles from "./landing.module.css";

const PHOTO_PAGE = "https://www.pexels.com/photo/a-family-eating-dinner-together-11368637/";

export function Photo() {
  return (
    <figure className={styles.photo}>
      <div className={styles.photoFrame}>
        <Image
          src={familyDinner}
          alt="Three generations around a candlelit dinner table at home: two older women and a young girl smile and talk over plates, glasses and a sweet pie."
          placeholder="blur"
          sizes="(max-width: 860px) calc(100vw - 2rem), 580px"
          className={styles.photoImg}
        />
      </div>
      <figcaption className={styles.credit}>
        Photo:{" "}
        <a href={PHOTO_PAGE} target="_blank" rel="noopener noreferrer">
          Anna Shvets on Pexels<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  );
}
