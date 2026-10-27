"use client";
// Fades a section up as it scrolls into view. Without JavaScript, or with reduced motion, the
// section is simply shown: it is only hidden once this effect has run and armed the observer.
import { useEffect, useRef } from "react";
import styles from "./landing.module.css";

export function FadeUp({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen (short window, reload mid-page): leave it alone.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.fade = "armed";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.fade = "shown";
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${styles.fade} ${className}`}>
      {children}
    </div>
  );
}
