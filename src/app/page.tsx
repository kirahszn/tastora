import { Closing } from "./_landing/Closing";
import { FadeUp } from "./_landing/FadeUp";
import { Hero } from "./_landing/Hero";
import { Problem } from "./_landing/Problem";
import { QlooProof } from "./_landing/QlooProof";
import { Rules } from "./_landing/Rules";
import { SeeItWork } from "./_landing/SeeItWork";
import styles from "./_landing/landing.module.css";

export default function Home() {
  return (
    <div className={styles.landing} data-layout="wide">
      <Hero />
      <FadeUp>
        <Problem />
      </FadeUp>
      <SeeItWork />
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
