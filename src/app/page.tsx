import { EntryCards } from "./_landing/EntryCards";
import { FadeUp } from "./_landing/FadeUp";
import { Hero } from "./_landing/Hero";
import { HowItWorks } from "./_landing/HowItWorks";
import { Illustration } from "./_landing/Illustration";
import { TrustStrip } from "./_landing/TrustStrip";
import styles from "./_landing/landing.module.css";

export default function Home() {
  return (
    <div className={styles.landing} data-layout="wide">
      <Hero />
      <FadeUp>
        <Illustration />
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
