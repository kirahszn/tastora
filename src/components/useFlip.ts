"use client";
// FLIP animation for lists whose items move: call `capture()` just before the state change, and after
// the next render every child marked `data-flip="<key>"` glides from where it was to where it is
// now; keys that weren't there before fade in. With reduced motion nothing animates.
import { useLayoutEffect, useRef } from "react";

const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

export const prefersReducedMotion = () =>
  typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function measure(root: HTMLElement | null): Map<string, DOMRect> {
  const out = new Map<string, DOMRect>();
  root?.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => out.set(el.dataset.flip!, el.getBoundingClientRect()));
  return out;
}

export function useFlip<T extends HTMLElement>({ duration = 650, stagger = 35 } = {}) {
  const ref = useRef<T>(null);
  const before = useRef<Map<string, DOMRect> | null>(null);

  // Runs after every render, but only animates when `capture()` ran first.
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = null;
    const root = ref.current;
    if (!prev || !root || prefersReducedMotion() || typeof root.animate !== "function") return;
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el, i) => {
      const now = el.getBoundingClientRect();
      const was = prev.get(el.dataset.flip!);
      const delay = i * stagger;
      if (was) {
        const dx = was.left - now.left;
        const dy = was.top - now.top;
        if (!dx && !dy) return;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
          duration,
          delay,
          easing: EASE,
          fill: "backwards",
        });
      } else {
        el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], {
          duration: duration * 0.7,
          delay: delay + 120,
          easing: EASE,
          fill: "backwards",
        });
      }
    });
  });

  return {
    ref,
    capture: () => {
      before.current = measure(ref.current);
    },
  };
}
