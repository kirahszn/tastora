import { EntryCards } from "./_landing/EntryCards";
import { FadeUp } from "./_landing/FadeUp";
import { Hero } from "./_landing/Hero";
import { HowItWorks } from "./_landing/HowItWorks";
import { Photo } from "./_landing/Photo";
import { TrustStrip } from "./_landing/TrustStrip";
import styles from "./_landing/landing.module.css";

export default function Home() {
  return (
    <div className={styles.landing} data-layout="wide">
      <Hero />
      <FadeUp>
        <Photo />
      </FadeUp>
      <FadeUp>
        <EntryCards />
      </FadeUp>
      <FadeUp>
        <HowItWorks />
      </FadeUp>
      <FadeUp>
        <TrustStrip />
      </FadeUp>
    </div>
  );
}
