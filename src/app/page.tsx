import { Closing } from "./_landing/Closing";
import { FadeUp } from "./_landing/FadeUp";
import { Hero } from "./_landing/Hero";
import { HowItWorks } from "./_landing/HowItWorks";
import { Problem } from "./_landing/Problem";
import { QlooProof } from "./_landing/QlooProof";
import { Rerank } from "./_landing/Rerank";
import { Rules } from "./_landing/Rules";
import { SafetyCheck } from "./_landing/SafetyCheck";
import styles from "./_landing/landing.module.css";

export default function Home() {
  return (
    <div className={styles.landing} data-layout="wide">
      <Hero />
      <FadeUp>
        <Problem />
      </FadeUp>
      <Rerank />
      <SafetyCheck />
      <FadeUp>
        <HowItWorks />
      </FadeUp>
      <FadeUp>
        <QlooProof />
      </FadeUp>
      <FadeUp>
        <Rules />
      </FadeUp>
      <Closing />
    </div>
  );
}
