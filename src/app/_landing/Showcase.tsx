"use client";
// "How it works": an accordion beside a phone showing the matching real screen. Before hydration
// (and without JavaScript) every panel is open and the phone shows the first screen, so all the
// text is readable; after hydration one panel is open at a time.
import Image, { type StaticImageData } from "next/image";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useHydrated } from "@/components/useHydrated";
import askShot from "../../../public/images/screen-phone-ask.jpg";
import avoidShot from "../../../public/images/screen-phone-avoid.jpg";
import memoriesShot from "../../../public/images/screen-phone-memories.jpg";
import whyShot from "../../../public/images/screen-phone-why.jpg";
import { Phone, SectionHead } from "./Devices";
import styles from "./landing.module.css";

const ITEMS: { title: string; text: string; shot: StaticImageData; alt: string }[] = [
  {
    title: "Taste memories",
    text: "Add the singers, films and places they love. Qloo uses them to find restaurants enjoyed by people with similar tastes.",
    shot: memoriesShot,
    alt: "The profile form's Taste memories section on a phone, with Frank Sinatra added under Music and empty fields for films and places.",
  },
  {
    title: "Must avoid",
    text: "List allergies, diet rules and texture needs. Tastora checks every result against them, and anything it can’t confirm is marked “Needs confirmation”.",
    shot: avoidShot,
    alt: "The profile form's Must avoid panel on a phone: quick-add buttons for common allergies, and “no pork” added as a dietary restriction.",
  },
  {
    title: "Why this place",
    text: "Each suggestion lists its reasons, like Qloo’s rank for their tastes or a related cuisine, and shows every need as Matched, Needs confirmation or Conflict.",
    shot: whyShot,
    alt: "A result card for Lenny's Clam Bar on a phone, with its reasons and their needs: Diet: no pork needs confirmation, Comfort: wheelchair access matched.",
  },
  {
    title: "What to ask",
    text: "Every card ends with dishes to ask about and the questions to put to the restaurant before you go, plus Call and Website buttons when Qloo lists them.",
    shot: askShot,
    alt: "The end of a result card on a phone: dishes to ask about, an “Ask the restaurant” box with “Ask which dishes are made without pork”, and Website, Call and Maps buttons.",
  },
];

export function Showcase() {
  const hydrated = useHydrated();
  const [open, setOpen] = useState<number | null>(0);
  const [shown, setShown] = useState(0);

  const toggle = (i: number) => {
    setOpen(open === i ? null : i);
    setShown(i);
  };

  return (
    <section id="how" className={`${styles.section} ${styles.band}`} aria-labelledby="how-h">
      <SectionHead id="how-h" eyebrow="How it works" title="From a favourite song to the right table" />
      <div className={styles.showcase}>
        <div className={styles.accordion}>
          {ITEMS.map((item, i) => {
            const expanded = !hydrated || open === i;
            return (
              <div key={item.title} className={styles.accItem} data-open={expanded}>
                <h3 className={styles.accHeading}>
                  <button
                    type="button"
                    id={`acc-b${i}`}
                    className={styles.accButton}
                    aria-expanded={expanded}
                    aria-controls={`acc-p${i}`}
                    onClick={() => toggle(i)}
                  >
                    {item.title}
                    <span className={styles.accSign}>
                      <Icon name={expanded ? "minus" : "plus"} size={18} />
                    </span>
                  </button>
                </h3>
                <div id={`acc-p${i}`} role="region" aria-labelledby={`acc-b${i}`} hidden={!expanded} className={styles.accPanel}>
                  <p>{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <Phone>
          {ITEMS.map((item, i) => (
            <Image
              key={item.title}
              src={item.shot}
              alt={item.alt}
              placeholder="blur"
              sizes="300px"
              loading="eager" // all four, so switching items never waits on a hidden lazy image
              className={styles.phoneImg}
              data-active={i === shown}
            />
          ))}
        </Phone>
      </div>
    </section>
  );
}
