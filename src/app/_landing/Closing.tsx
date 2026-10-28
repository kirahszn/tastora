// Closing band over a dimmed photo: Pexels photo 31705508 by Juan TM (Pexels License), see Photo.tsx.
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import sharedPlates from "../../../public/images/shared-plates.jpg";
import styles from "./landing.module.css";

export function Closing() {
  return (
    <section className={styles.closing} aria-labelledby="closing-h">
      <Image src={sharedPlates} alt="" placeholder="blur" sizes="100vw" className={styles.closingImg} />
      <div className={styles.closingInner}>
        <h2 id="closing-h" className={styles.closingTitle}>
          Ready when you are. <span className={styles.closingMuted}>Start with an example, then make it theirs.</span>
        </h2>
        <Link href="/profile#examples" className={`btn btn-primary ${styles.cta}`}>
          Try the example
          <span className={styles.arrow}>
            <Icon name="arrow" size={18} />
          </span>
        </Link>
      </div>
    </section>
  );
}
