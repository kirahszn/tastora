import { Closing } from "./_landing/Closing";
import { FadeUp } from "./_landing/FadeUp";
import { Hero } from "./_landing/Hero";
import { Problem } from "./_landing/Problem";
import { QlooProof } from "./_landing/QlooProof";
import { Showcase } from "./_landing/Showcase";
import { Steps } from "./_landing/Steps";
import { Values } from "./_landing/Values";
import styles from "./_landing/landing.module.css";

export default function Home() {
  return (
    <div className={styles.landing} data-layout="wide">
      <Hero />
      <FadeUp>
        <Problem />
      </FadeUp>
      <FadeUp>
        <Values />
      </FadeUp>
      <FadeUp>
        <Showcase />
      </FadeUp>
      <FadeUp>
        <QlooProof />
      </FadeUp>
      <FadeUp>
        <Steps />
      </FadeUp>
      <FadeUp>
        <Closing />
      </FadeUp>
    </div>
  );
}
