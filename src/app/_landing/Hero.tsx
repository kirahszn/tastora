import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import resultsShot from "../../../public/images/screen-results-desktop.jpg";
import { Laptop } from "./Devices";
import styles from "./landing.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-h">
      <div className={styles.heroText}>
        <p className={styles.eyebrow}>For caregivers</p>
        <h1 id="hero-h" className={styles.headline}>
          Good food should still feel <span className={styles.headlineAccent}>like home.</span>
        </h1>
        <p className={styles.lede}>
          Tell us what someone you care for loves, from favourite dishes to the singer they still hum along to.
          Tastora finds restaurants near them that fit their taste, and tells you exactly what to ask before you go.
        </p>
        <Link href="/profile" className={`btn btn-primary ${styles.cta}`}>
          Find food for someone you care for
          <span className={styles.arrow}>
            <Icon name="arrow" size={18} />
          </span>
        </Link>
        <p className={styles.heroNote}>Free · No sign-up</p>
      </div>
      <Laptop>
        <Image
          src={resultsShot}
          alt="Tastora's results page for the Sinatra example: “Places Dad might enjoy”, 8 suggestions near Queens. The first, Lenny's Clam Bar in Howard Beach, says why it was suggested: Qloo ranked it #3 for this person's tastes, Italian related to Italian-American, and a wheelchair accessible entrance."
          placeholder="blur"
          preload
          sizes="(max-width: 860px) calc(100vw - 4rem), 900px"
          className={styles.screenImg}
        />
      </Laptop>
    </section>
  );
}
